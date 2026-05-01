import axios from "axios";
import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";
import { logger } from "../../shared/utils/logger";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ArticleMetadata {
  title: string;
  source: string;
  wordCount: number;
  readingTimeMinutes: number;
  skimTimeMinutes: number;
  difficulty: "easy" | "medium" | "hard";
  summary: string[];
  content: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * Average adult reading speed in words per minute.
 * Research puts this between 200–250 wpm. We use 220 as a balanced default.
 */
const READING_WPM = 220;

/**
 * Skim reading is typically 2–3x faster than full reading.
 * We use 2.5x as a reasonable middle ground.
 */
const SKIM_WPM = READING_WPM * 2.5;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Strips all HTML tags and returns plain text.
 *
 * Why not use a library for this? For our purposes (counting words,
 * calculating difficulty) we just need raw text — a simple regex works fine
 * and avoids an extra dependency.
 */
function htmlToPlainText(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ") // Replace any <tag> with a space
    .replace(/&nbsp;/g, " ") // Replace HTML entity for non-breaking space
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ") // Collapse multiple spaces into one
    .trim();
}

/**
 * Counts words in a plain-text string.
 * We split on whitespace — simple and fast enough for our purposes.
 */
function countWords(text: string): number {
  return text.split(/\s+/).filter((word) => word.length > 0).length;
}

/**
 * Estimates reading time in minutes, rounded up to the nearest half-minute.
 *
 * Why round up? It's better to slightly over-promise than under-promise
 * a reading time estimate. Nobody likes finishing later than expected.
 */
function estimateReadingTime(wordCount: number, wpm: number): number {
  const rawMinutes = wordCount / wpm;
  // Round to nearest 0.5 minute
  return Math.max(1, Math.round(rawMinutes * 2) / 2);
}

/**
 * Calculates a difficulty score based on two linguistic signals:
 *
 * 1. Average word length — longer words tend to be more complex (e.g.,
 *    "cat" vs "photosynthesis"). This is a core feature in classic
 *    readability formulas like Flesch-Kincaid.
 *
 * 2. Average sentence length — more words per sentence increases cognitive
 *    load. Short sentences are easier to parse.
 *
 * Thresholds are tuned heuristically for general web articles:
 * - easy:   short words + short sentences (e.g. news articles, blog posts)
 * - medium: moderate complexity (e.g. technical blogs, Wikipedia)
 * - hard:   long words + long sentences (e.g. academic papers, whitepapers)
 */
function calculateDifficulty(text: string): "easy" | "medium" | "hard" {
  const words = text.split(/\s+/).filter((w) => w.length > 0);
  if (words.length === 0) return "medium";

  // Signal 1: Average word length (characters)
  const avgWordLength =
    words.reduce(
      (sum, word) => sum + word.replace(/[^a-zA-Z]/g, "").length,
      0,
    ) / words.length;

  // Signal 2: Average sentence length (words per sentence)
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  const avgSentenceLength =
    sentences.length > 0 ? words.length / sentences.length : words.length;

  if (avgWordLength < 4.5 && avgSentenceLength < 15) return "easy";
  if (avgWordLength > 5.5 || avgSentenceLength > 25) return "hard";
  return "medium";
}

/**
 * Extracts a basic summary from the article text.
 *
 * This is a placeholder for real AI summarization (Phase 2).
 * For now, we use a simple extractive approach:
 *   - Split the article into sentences
 *   - Pick the first N sentences from the opening paragraphs
 *
 * Extractive summarization picks actual sentences from the source text.
 * Abstractive summarization (what LLMs do) generates new sentences.
 * Extractive is deterministic and free; abstractive requires an LLM API call.
 */
function extractSummary(text: string, numPoints: number = 3): string[] {
  const sentences = text
    .split(/(?<=[.!?])\s+/) // Split AFTER sentence-ending punctuation
    .map((s) => s.trim())
    .filter((s) => s.length > 40 && s.length < 300); // Skip very short or very long sentences

  // Take sentences from the first third of the article (the lede/intro)
  const introSentences = sentences.slice(
    0,
    Math.max(numPoints * 2, Math.ceil(sentences.length / 3)),
  );

  // Score each by length (longer = more informative) and pick the top N
  const scored = introSentences
    .map((s) => ({ sentence: s, score: s.split(/\s+/).length }))
    .sort((a, b) => b.score - a.score)
    .slice(0, numPoints)
    .map((s) => s.sentence);

  // Return in original order (so summary reads naturally)
  return scored.length > 0
    ? scored
    : ["No summary could be extracted from this article."];
}

// ─── Main Scraper ─────────────────────────────────────────────────────────────

/**
 * Fetches and parses an article from a URL.
 *
 * The pipeline:
 * 1. axios downloads the raw HTML of the page
 * 2. jsdom parses that HTML into a DOM tree (like a browser would)
 * 3. @mozilla/readability walks the DOM, identifies the main article content,
 *    and strips everything else (ads, navbars, sidebars, footers)
 * 4. We run our analysis functions over the clean content
 *
 * Why do we need jsdom?
 * Node.js has no built-in DOM. Readability was built to run IN a browser
 * where `document` already exists. jsdom creates a simulated browser
 * environment so Readability has the APIs it expects.
 */
export async function scrapeArticle(url: string): Promise<ArticleMetadata> {
  logger.info(`Scraping article from: ${url}`);

  // ── Step 1: Fetch the HTML ──────────────────────────────────────────────────
  let html: string;
  try {
    const response = await axios.get<string>(url, {
      timeout: 15_000, // 15 second timeout — don't wait forever for slow sites
      headers: {
        // Pretend to be a real browser. Many sites block requests that don't
        // have a User-Agent header (they assume it's a bot and serve an error
        // page or a Cloudflare challenge instead of the article).
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
      maxRedirects: 5, // Follow redirects (e.g. short URLs, canonical redirects)
    });
    html = response.data;
  } catch (error: any) {
    logger.error(`Failed to fetch URL ${url}:`, error.message);
    throw new Error(`Could not fetch article: ${error.message}`);
  }

  // ── Step 2: Parse HTML into a DOM with jsdom ────────────────────────────────
  // The `url` argument is crucial — Readability uses it to resolve relative
  // image/link URLs to absolute ones.
  const dom = new JSDOM(html, { url });
  const document = dom.window.document;

  // ── Step 3: Extract article content with Readability ───────────────────────
  // Readability's isProbablyReaderable() checks if the page has enough
  // text content to be worth extracting. Useful guard against extracting
  // login pages, error pages, etc.
  const reader = new Readability(document);
  const article = reader.parse();

  if (!article || !article.content) {
    throw new Error(
      "Could not extract article content. The page may require JavaScript to render, or may not contain article-style content.",
    );
  }

  logger.info(`Successfully extracted article: "${article.title}"`);

  // ── Step 4: Derive metadata from extracted content ─────────────────────────
  const plainText = htmlToPlainText(article.content);
  const wordCount = countWords(plainText);
  const readingTimeMinutes = estimateReadingTime(wordCount, READING_WPM);
  const skimTimeMinutes = estimateReadingTime(wordCount, SKIM_WPM);
  const difficulty = calculateDifficulty(plainText);
  const summary = extractSummary(plainText);

  // Derive source from the URL hostname, stripping "www."
  const source = new URL(url).hostname.replace(/^www\./, "");

  // Use Readability's extracted title, falling back to the page <title> tag,
  // then finally to the URL itself.
  const title =
    article.title ||
    document.querySelector("title")?.textContent?.trim() ||
    url;

  logger.info(
    `Article stats — words: ${wordCount}, readTime: ${readingTimeMinutes}min, difficulty: ${difficulty}`,
  );

  return {
    title,
    source,
    wordCount,
    readingTimeMinutes,
    skimTimeMinutes,
    difficulty,
    summary,
    content: article.content, // Clean HTML — ready to render in the reading view
  };
}
