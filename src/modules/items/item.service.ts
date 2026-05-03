import Item from "./item.model";
import { logger } from "../../shared/utils/logger";
import { scrapeArticle } from "./article.scraper";
import { articleQueue } from "../../config/queue";

export interface CreateItemInput {
  url: string;
  clerkUserId: string;
}

export interface CreateItemResult {
  id: string;
  status: string;
}

export class ItemService {
  /**
   * Validates URL format
   */
  private validateUrl(url: string): void {
    if (!url || typeof url !== "string") {
      throw new Error("URL is required");
    }

    try {
      const parsedUrl = new URL(url);
      if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
        throw new Error("URL must use http or https protocol");
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes("protocol")) {
        throw error;
      }
      throw new Error("Invalid URL format");
    }
  }

  /**
   * Creates a new item for a user
   */
  async createItem(input: CreateItemInput): Promise<CreateItemResult> {
    const { url, clerkUserId } = input;

    // Validate URL
    this.validateUrl(url);

    try {
      // Create DB record with "processing" status
      const item = await Item.create({
        url: url.trim(),
        clerkUserId,
        status: "processing",
        title: url.trim(), // Temporary title until processing completes
      });

      logger.info(`Item created: ${item._id} for user ${clerkUserId}`);

      // TODO: Trigger background job to fetch article metadata
      // This could be done via:
      // - Queue system (Bull, BullMQ)
      // - Pub/Sub (Redis, RabbitMQ)
      // - Serverless functions
      this.queueArticleProcessing(item._id.toString(), url);

      return {
        id: item._id.toString(),
        status: item.status,
      };
    } catch (error: any) {
      // Handle duplicate URL error
      if (error.code === 11000) {
        throw new Error("URL already exists for this user");
      }

      // Handle validation errors
      if (error.name === "ValidationError") {
        throw new Error(error.message);
      }

      logger.error("Error creating item:", error);
      throw new Error("Failed to create item");
    }
  }

  /**
   * Gets an item by ID for a specific user
   */
  async getItemById(itemId: string, clerkUserId: string): Promise<any | null> {
    try {
      const item = await Item.findOne({
        _id: itemId,
        clerkUserId,
      }).lean();

      if (!item) {
        return null;
      }

      // Transform MongoDB document to API response format
      return {
        id: item._id.toString(),
        url: item.url,
        title: item.title,
        source: item.source,
        wordCount: item.wordCount,
        readingTimeMinutes: item.readingTimeMinutes,
        difficulty: item.difficulty,
        summary: item.summary,
        content: item.content,
        status: item.isCompleted ? "read" : item.status,
        savedAt: item.savedAt,
        isCompleted: item.isCompleted,
        isSkimmed: item.isSkimmed,
      };
    } catch (error) {
      logger.error(`Error fetching item ${itemId}:`, error);
      throw new Error("Failed to fetch item");
    }
  }

  /**
   * Gets all items for a user
   */
  async getItems(clerkUserId: string, status?: string): Promise<any[]> {
    try {
      const query: any = { clerkUserId };

      if (status && status !== "all") {
        query.status = status;
      }

      const items = await Item.find(query).sort({ savedAt: -1 }).lean();

      return items.map((item) => ({
        id: item._id.toString(),
        url: item.url,
        title: item.title,
        source: item.source,
        wordCount: item.wordCount,
        readingTimeMinutes: item.readingTimeMinutes,
        difficulty: item.difficulty,
        summary: item.summary,
        content: item.content,
        status: item.isCompleted ? "read" : item.status,
        savedAt: item.savedAt,
        isCompleted: item.isCompleted,
        isSkimmed: item.isSkimmed,
      }));
    } catch (error) {
      logger.error("Error fetching items:", error);
      throw new Error("Failed to fetch items");
    }
  }

  /**
   * Adds an article processing job to the BullMQ queue.
   *
   * This method returns immediately — it only writes the job to Redis.
   * The actual scraping happens in article.worker.ts, in a separate process.
   *
   * Using the itemId as the job name (second argument) makes it easy to look
   * up a specific job in monitoring tools like Bull Board.
   */
  private async queueArticleProcessing(
    itemId: string,
    url: string,
  ): Promise<void> {
    await articleQueue.add(itemId, { itemId, url });
    logger.info(`Job added to queue for item: ${itemId}`);
  }

  /**
   * Fetches article metadata by scraping the real URL.
   * Delegates to the article scraper module.
   */
  private async fetchArticleMetadata(url: string) {
    return scrapeArticle(url);
  }

  /**
   * Processes article metadata (for background worker)
   * This should be called by a background job processor
   */
  async processArticleMetadata(itemId: string, url: string): Promise<void> {
    try {
      logger.info(`Processing article metadata for item: ${itemId}`);

      // Fetch article metadata
      const metadata = await this.fetchArticleMetadata(url);

      // Update item with fetched metadata
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
          status: "ready", // Mark as ready after successful processing
        },
        { new: true }, // Return updated document
      );

      if (!updatedItem) {
        throw new Error(`Item ${itemId} not found`);
      }

      logger.info(
        `Article processing completed for item: ${itemId} - "${metadata.title}"`,
      );
    } catch (error) {
      logger.error(
        `Failed to process article metadata for item ${itemId}:`,
        error,
      );

      // Update item status to failed
      await Item.findByIdAndUpdate(itemId, {
        status: "failed",
      });
    }
  }

  // ─── New endpoints ─────────────────────────────────────────────────────────

  /**
   * GET /items/today
   *
   * Returns the user's daily reading queue: up to 3 items that are:
   *   - status: "ready"     (fully processed, content available)
   *   - isCompleted: false  (not yet read)
   *   - isSkimmed: false    (not yet skimmed)
   *
   * Sorted oldest-first so the user works through articles in the order
   * they saved them (FIFO — first in, first out). Limited to 3 to enforce
   * the app's scarcity mechanic.
   */
  async getTodaysItems(clerkUserId: string): Promise<any[]> {
    try {
      const now = new Date();
      const items = await Item.find({
        clerkUserId,
        status: "ready",
        isCompleted: false,
        isSkimmed: false,
        // Exclude items that are currently snoozed.
        // $or means: either no snoozedUntil date at all, OR the snooze
        // has already expired. This makes snoozes self-healing — no cron
        // job needed to reset them.
        $or: [{ snoozedUntil: null }, { snoozedUntil: { $lte: now } }],
      })
        .sort({ savedAt: 1 })
        .limit(3)
        .lean();

      return items.map((item) => ({
        id: item._id.toString(),
        url: item.url,
        title: item.title,
        source: item.source,
        wordCount: item.wordCount,
        readingTimeMinutes: item.readingTimeMinutes,
        difficulty: item.difficulty,
        summary: item.summary,
        status: item.status,
        savedAt: item.savedAt,
        isCompleted: item.isCompleted,
        isSkimmed: item.isSkimmed,
      }));
    } catch (error) {
      logger.error("Error fetching today's items:", error);
      throw new Error("Failed to fetch today's items");
    }
  }

  /**
   * PATCH /items/:id/complete
   *
   * Marks an item as read or skimmed. These are mutually exclusive states:
   *   - isCompleted: true  → user read the full article
   *   - isSkimmed: true    → user skimmed only the summary
   *
   * Why not one "status" field for this?
   * The item's top-level `status` field represents the processing lifecycle
   * (processing → ready → failed). Read/skim state is a separate dimension
   * (the user's engagement with the content), so we keep them as boolean flags.
   */
  async completeItem(
    itemId: string,
    clerkUserId: string,
    isCompleted: boolean,
    isSkimmed: boolean,
  ): Promise<any | null> {
    try {
      const item = await Item.findOneAndUpdate(
        { _id: itemId, clerkUserId }, // Scope to user — prevents updating someone else's items
        { isCompleted, isSkimmed },
        { new: true },
      ).lean();

      if (!item) return null;

      return {
        id: item._id.toString(),
        isCompleted: item.isCompleted,
        isSkimmed: item.isSkimmed,
      };
    } catch (error) {
      logger.error(`Error completing item ${itemId}:`, error);
      throw new Error("Failed to update item");
    }
  }

  /**
   * PATCH /items/:id/feedback
   *
   * Records the user's post-read rating: "was this worth saving?"
   * Optionally includes a free-text note.
   *
   * This data is the long-term value of the app — it could be used later
   * to build personalized recommendations ("save articles like the ones
   * you rated 'yes'").
   */
  async submitFeedback(
    itemId: string,
    clerkUserId: string,
    worthReadingFeedback: "yes" | "no",
    note?: string,
  ): Promise<any | null> {
    try {
      const updatePayload: Record<string, any> = { worthReadingFeedback };
      if (note !== undefined) updatePayload.note = note;

      const item = await Item.findOneAndUpdate(
        { _id: itemId, clerkUserId },
        updatePayload,
        { new: true },
      ).lean();

      if (!item) return null;

      return {
        id: item._id.toString(),
        worthReadingFeedback: item.worthReadingFeedback,
      };
    } catch (error) {
      logger.error(`Error submitting feedback for item ${itemId}:`, error);
      throw new Error("Failed to submit feedback");
    }
  }

  /**
   * DELETE /items/:id
   *
   * Hard deletes the item from MongoDB.
   *
   * We're using hard delete here (permanent removal) because:
   * - This is a personal productivity tool, not a multi-tenant system
   * - There's no audit trail requirement
   * - Simpler than maintaining a soft-delete flag
   *
   * If you ever need to recover deleted items or show them in a "trash" view,
   * switch to soft delete: add `isDeleted: boolean` to the schema and filter
   * it out of all queries.
   */
  async deleteItem(itemId: string, clerkUserId: string): Promise<boolean> {
    try {
      const result = await Item.deleteOne({ _id: itemId, clerkUserId });
      return result.deletedCount === 1;
    } catch (error) {
      logger.error(`Error deleting item ${itemId}:`, error);
      throw new Error("Failed to delete item");
    }
  }

  /**
   * PATCH /items/:id/snooze
   *
   * Snoozes an item until midnight tonight (the start of tomorrow).
   * The item will reappear automatically in the next day's /today query
   * because getTodaysItems filters out items where snoozedUntil > now.
   *
   * Why midnight of the NEXT day and not 24 hours from now?
   * Snooze is a "not today" action, not a "remind me in 24 hours" alarm.
   * Snoozing at 11pm should hide the item until tomorrow morning,
   * not until 11pm tomorrow.
   */
  async snoozeItem(itemId: string, clerkUserId: string): Promise<any | null> {
    try {
      // Calculate midnight at the start of tomorrow in the server's local time.
      // For production you'd want to accept the user's timezone offset,
      // but for now server-local is a practical default.
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);

      const item = await Item.findOneAndUpdate(
        { _id: itemId, clerkUserId },
        { snoozedUntil: tomorrow },
        { new: true },
      ).lean();

      if (!item) return null;

      return {
        id: item._id.toString(),
        snoozedUntil: tomorrow,
      };
    } catch (error) {
      logger.error(`Error snoozing item ${itemId}:`, error);
      throw new Error("Failed to snooze item");
    }
  }
}

export const itemService = new ItemService();
