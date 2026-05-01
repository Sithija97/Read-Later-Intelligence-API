/**
 * Article Processing Worker
 *
 * This file is the CONSUMER side of the queue. It runs as a separate process
 * (or can be co-located in the same process during development) and picks up
 * jobs that the API server (producer) adds to the queue.
 *
 * The separation matters in production:
 * - The API server stays fast and responsive (it just adds jobs, never blocks)
 * - The worker can be scaled independently (e.g. 3 API servers, 10 workers)
 * - Workers can be deployed on cheaper CPU-optimized machines
 * - If the worker crashes, the API server keeps accepting new URLs
 */

import mongoose from "mongoose";
import { Worker, Job } from "bullmq";
import {
  ARTICLE_QUEUE_NAME,
  ArticleJobData,
  redisConnection,
} from "../../config/queue";
import { scrapeArticle } from "./article.scraper";
import { logger } from "../../shared/utils/logger";
import { env } from "../../config/env";
import Item from "./item.model";

// ─── Connect to MongoDB ───────────────────────────────────────────────────────
//
// The worker needs its own DB connection because it runs as its own process.
// It doesn't share the connection pool with the API server.

async function connectDB(): Promise<void> {
  if (!env.MONGO_URI) throw new Error("MONGO_URI is required");
  await mongoose.connect(env.MONGO_URI);
  logger.info("Worker: MongoDB connected");
}

// ─── Job Processor ────────────────────────────────────────────────────────────
//
// This function is called by BullMQ for each job. It receives a Job object
// that contains the data we put in when adding the job (itemId + url).
//
// Whatever this function throws, BullMQ catches it and:
// - If attempts remain: waits for backoff delay, then retries
// - If all attempts exhausted: marks the job as "failed"
//
// Returning normally (or returning a value) marks the job as "completed".

async function processArticleJob(job: Job<ArticleJobData>): Promise<void> {
  const { itemId, url } = job.data;

  logger.info(`Worker processing job ${job.id} — item: ${itemId}, url: ${url}`);

  try {
    // Scrape the article (the real work happens here)
    const metadata = await scrapeArticle(url);

    // Write results to MongoDB
    const updatedItem = await Item.findByIdAndUpdate(
      itemId,
      {
        title: metadata.title,
        source: metadata.source,
        wordCount: metadata.wordCount,
        readingTimeMinutes: metadata.readingTimeMinutes,
        difficulty: metadata.difficulty,
        summary: metadata.summary,
        content: metadata.content,
        status: "ready",
      },
      { new: true },
    );

    if (!updatedItem) {
      // The item was deleted before processing completed — not a worker error,
      // so we log it but don't throw (don't retry a job for a deleted item).
      logger.warn(`Worker: item ${itemId} not found in DB, skipping`);
      return;
    }

    logger.info(
      `Worker: job ${job.id} completed — "${metadata.title}" (${metadata.wordCount} words, ${metadata.readingTimeMinutes}min)`,
    );
  } catch (error: any) {
    // Log which attempt this is so we can see retry progression in logs
    logger.error(
      `Worker: job ${job.id} failed on attempt ${job.attemptsMade + 1}/${job.opts.attempts}: ${error.message}`,
    );

    // Re-throw so BullMQ knows this attempt failed and should retry
    throw error;
  }
}

// ─── Mark Item as Failed After All Retries Exhausted ─────────────────────────

async function onJobFailed(
  job: Job<ArticleJobData> | undefined,
  error: Error,
): Promise<void> {
  if (!job) return;

  logger.error(
    `Worker: job ${job.id} exhausted all retry attempts. Marking item ${job.data.itemId} as failed.`,
  );

  await Item.findByIdAndUpdate(job.data.itemId, { status: "failed" }).catch(
    (dbError) =>
      logger.error(
        `Worker: could not mark item ${job.data.itemId} as failed in DB:`,
        dbError,
      ),
  );
}

// ─── Start the Worker ─────────────────────────────────────────────────────────

async function startWorker(): Promise<void> {
  await connectDB();

  // The Worker constructor takes:
  // 1. Queue name (must match the producer's queue name exactly)
  // 2. The processor function
  // 3. Options including the Redis connection
  //
  // concurrency: 2 means the worker will process up to 2 jobs simultaneously.
  // For CPU-bound tasks you'd set this to your CPU core count.
  // For I/O-bound tasks (HTTP fetching + DB writes, like ours) you can go higher.
  // Start conservative and increase if you need throughput.

  const worker = new Worker<ArticleJobData>(
    ARTICLE_QUEUE_NAME,
    processArticleJob,
    {
      connection: redisConnection,
      concurrency: 2,
    },
  );

  worker.on("completed", (job) => {
    logger.info(`Worker: job ${job.id} completed successfully`);
  });

  worker.on("failed", onJobFailed);

  worker.on("error", (error) => {
    logger.error("Worker error:", error);
  });

  logger.info(
    `Article processing worker started (concurrency: 2, queue: "${ARTICLE_QUEUE_NAME}")`,
  );
}

startWorker().catch((error) => {
  logger.error("Fatal worker startup error:", error);
  process.exit(1);
});
