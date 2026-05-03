/**
 * AI Summarizer — Phase 3A
 *
 * Uses OpenAI's Chat Completions API to generate a structured summary
 * from article content. The module is designed to be opt-in:
 *   - If OPENAI_API_KEY is configured → AI summary
 *   - If not configured → caller uses its own fallback (extractive summary)
 *
 * ── Why Chat Completions over the older Completions API? ─────────────────────
 * The Chat Completions API (gpt-4o-mini, gpt-4o, etc.) uses a structured
 * messages[] format with distinct "system" and "user" roles. This separation
 * matters because:
 *   - System message: sets the model's persona, output format, and constraints
 *     (this doesn't change per request)
 *   - User message: the actual variable input (the article text)
 *
 * Splitting them this way makes prompt engineering cleaner and the model
 * tends to follow format instructions more reliably.
 */

import OpenAI from "openai";
import { env } from "../../config/env";
import { logger } from "../../shared/utils/logger";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AISummaryResult {
  summary: string[]; // 3 bullet-point takeaways
  difficulty: "easy" | "medium" | "hard";
}

// ─── OpenAI Client ────────────────────────────────────────────────────────────
//
// We create the client lazily (inside the function) rather than at module load
// time. Why? If OPENAI_API_KEY is missing, constructing the client at module
// level would throw immediately and crash the worker on startup, even if AI
// summarization is simply disabled. Lazy init means the app still boots fine
// without a key.

function getOpenAIClient(): OpenAI | null {
  if (!env.OPENAI_API_KEY) return null;
  return new OpenAI({ apiKey: env.OPENAI_API_KEY });
}

// ─── Prompt Design ────────────────────────────────────────────────────────────
//
// Good prompts have:
//   1. A clear role / persona for the model
//   2. Explicit output format instructions (we want JSON, not prose)
//   3. Constraints (length, tone, what NOT to do)
//   4. A worked example of the expected output (few-shot) — helps a lot
//      with structured output tasks.
//
// We ask for JSON output directly. An alternative is OpenAI's structured
// outputs feature (response_format: { type: "json_schema" }) which guarantees
// valid JSON, but requires a newer API version. Plain JSON via prompt is
// simpler and works well enough here.

const SYSTEM_PROMPT = `You are an expert article summarizer for a read-later app.
Your job is to help busy readers decide if an article is worth their full attention.

Given the text of an article, you must respond with ONLY valid JSON in this exact format:
{
  "summary": [
    "First key takeaway in one clear sentence",
    "Second key takeaway in one clear sentence",
    "Third key takeaway in one clear sentence"
  ],
  "difficulty": "easy" | "medium" | "hard"
}

Rules for summary:
- Exactly 3 items in the array
- Each item is a standalone insight — not a vague description ("the article discusses...")
- Use active voice and concrete language
- Maximum 20 words per bullet
- Focus on the most actionable or surprising findings

Rules for difficulty:
- "easy": conversational, short sentences, common vocabulary (e.g. blog post, news article)
- "medium": technical or detailed, requires some background knowledge (e.g. technical blog, Wikipedia)
- "hard": academic, dense terminology, long complex sentences (e.g. research paper, whitepaper)

Do not include any text outside the JSON object. No markdown, no explanation.`;

// ─── Token Budget ─────────────────────────────────────────────────────────────
//
// GPT-4o-mini has a 128k token context window. Each token is ~4 characters.
// A typical article is 1,000–3,000 words (~1,500–4,000 tokens).
// We cap at 8,000 tokens of article text (~32,000 chars) to keep costs low
// while capturing enough content for an accurate summary.
// The opening of articles almost always contains the core thesis anyway.

const MAX_ARTICLE_CHARS = 32_000;

// ─── Main Function ────────────────────────────────────────────────────────────

/**
 * Generates an AI-powered summary and difficulty rating for an article.
 *
 * Returns null if:
 * - OPENAI_API_KEY is not configured
 * - The API call fails (caller should fall back to extractive summary)
 *
 * Why return null instead of throwing?
 * AI summarization is a "nice to have" enhancement — if it fails, the
 * article should still be saved and readable. Returning null lets the
 * caller decide the fallback behavior without a try/catch.
 */
export async function generateAISummary(
  articleText: string,
  title: string,
): Promise<AISummaryResult | null> {
  const client = getOpenAIClient();

  if (!client) {
    logger.info("AI summarization skipped — OPENAI_API_KEY not configured");
    return null;
  }

  // Truncate to our token budget. We truncate plain text (not HTML) so
  // we're not wasting tokens on HTML tags.
  const truncatedText = articleText.slice(0, MAX_ARTICLE_CHARS);

  logger.info(`Generating AI summary for: "${title}"`);

  try {
    const response = await client.chat.completions.create({
      // gpt-4o-mini is the sweet spot for this use case:
      // - Much cheaper than gpt-4o (roughly 15x less per token)
      // - Fast (low latency, important since the user is waiting on a poll)
      // - More than capable enough for summarization tasks
      model: "gpt-4o-mini",

      messages: [
        {
          role: "system",
          content: SYSTEM_PROMPT,
        },
        {
          role: "user",
          // Including the title gives the model context about the article's
          // angle before it sees the body text. This improves summary quality,
          // especially for articles where the opening paragraphs are preamble.
          content: `Article title: "${title}"\n\nArticle text:\n${truncatedText}`,
        },
      ],

      // max_tokens for the RESPONSE only (not the input).
      // Our JSON output is tiny — 3 short sentences + one word.
      // 300 tokens is generous and avoids the model getting cut off.
      max_tokens: 300,

      // temperature controls randomness: 0 = deterministic, 1 = creative.
      // For structured data extraction (we want consistent, factual JSON),
      // a low temperature (0.2–0.3) reduces hallucination and keeps output
      // format-compliant.
      temperature: 0.2,
    });

    const rawContent = response.choices[0]?.message?.content?.trim();
    if (!rawContent) {
      logger.warn("OpenAI returned an empty response");
      return null;
    }

    // Parse the JSON response. If the model ignored our format instructions
    // (rare but possible), JSON.parse will throw and we catch it below.
    const parsed: AISummaryResult = JSON.parse(rawContent);

    // Basic validation — ensure the model returned what we asked for
    if (!Array.isArray(parsed.summary) || parsed.summary.length === 0) {
      logger.warn("OpenAI response missing summary array, falling back");
      return null;
    }

    const validDifficulties = ["easy", "medium", "hard"];
    if (!validDifficulties.includes(parsed.difficulty)) {
      logger.warn(
        `OpenAI returned unknown difficulty "${parsed.difficulty}", defaulting to medium`,
      );
      parsed.difficulty = "medium";
    }

    logger.info(
      `AI summary generated — difficulty: ${parsed.difficulty}, tokens used: ${response.usage?.total_tokens ?? "unknown"}`,
    );

    return parsed;
  } catch (error: any) {
    // SyntaxError = model returned invalid JSON (format didn't follow instructions)
    // Other errors = network failure, rate limit, API error
    logger.error(`AI summarization failed: ${error.message}`);
    return null; // Let the caller fall back to extractive summary
  }
}
