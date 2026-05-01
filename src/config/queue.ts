import { Queue } from "bullmq";
import IORedis from "ioredis";
import { env } from "./env";

// ─── Shared Queue Name ────────────────────────────────────────────────────────
//
// Both the producer (API server that adds jobs) and the consumer (worker that
// runs jobs) must use the EXACT same queue name and Redis connection to talk
// to each other. This file is the single source of truth for both.

export const ARTICLE_QUEUE_NAME = "article-processing";

// ─── Redis Connection ─────────────────────────────────────────────────────────
//
// BullMQ doesn't manage its own Redis connection — you create one and hand it
// over. We use ioredis for this.
//
// maxRetriesPerRequest: null is REQUIRED for BullMQ. By default, ioredis retries
// failed commands a finite number of times. BullMQ uses Redis blocking commands
// (BLPOP-style) that can legitimately take a long time — ioredis would wrongly
// time these out without this setting.
//
// enableReadyCheck: false tells ioredis not to wait for a "READY" signal before
// allowing commands. BullMQ manages its own readiness internally.

export const redisConnection = new IORedis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

// ─── Job Data Type ────────────────────────────────────────────────────────────
//
// Typing the job payload means both the producer (when it adds a job) and the
// worker (when it processes it) agree on the shape of the data. TypeScript
// will catch mismatches at compile time.

export interface ArticleJobData {
  itemId: string;
  url: string;
}

// ─── The Queue (Producer Side) ────────────────────────────────────────────────
//
// A Queue instance is the "mouth" — it accepts new jobs and writes them to
// Redis. The API server uses this.
//
// defaultJobOptions:
// - attempts: 3    → retry failed jobs up to 3 times before marking as failed
// - backoff:       → wait before retrying (exponential: 2s, 4s, 8s)
//   type: "exponential" is important because if a site is temporarily down,
//   hammering it immediately won't help — backing off gives it time to recover.
// - removeOnComplete: 50 → keep the last 50 completed jobs for debugging.
//   Without this, Redis fills up with completed job records over time.
// - removeOnFail: 100    → keep the last 100 failed jobs so you can inspect them.

export const articleQueue = new Queue<ArticleJobData>(ARTICLE_QUEUE_NAME, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 2000, // Start with 2 seconds, then 4s, then 8s
    },
    removeOnComplete: 50,
    removeOnFail: 100,
  },
});
