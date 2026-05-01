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
}

export const itemService = new ItemService();
