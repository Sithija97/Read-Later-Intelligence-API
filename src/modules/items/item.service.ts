import Item from "./item.model";
import { logger } from "../../shared/utils/logger";

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
   * Queues article processing job
   * This is a placeholder for background processing integration
   */
  private async queueArticleProcessing(
    itemId: string,
    url: string
  ): Promise<void> {
    // TODO: Implement queue integration
    // Example with Bull:
    // await articleProcessingQueue.add('process-article', { itemId, url });

    logger.info(`Queued article processing for item: ${itemId}`);
  }

  /**
   * Processes article metadata (for background worker)
   * This should be called by a background job processor
   */
  async processArticleMetadata(itemId: string, url: string): Promise<void> {
    try {
      logger.info(`Processing article metadata for item: ${itemId}`);

      // TODO: Implement article fetching logic
      // - Fetch URL content
      // - Extract title, description, image
      // - Update item with metadata

      // Example:
      // const metadata = await this.fetchArticleMetadata(url);
      // await Item.findByIdAndUpdate(itemId, {
      //   title: metadata.title,
      //   description: metadata.description,
      //   imageUrl: metadata.image,
      //   status: 'ready'
      // });

      logger.info(`Article processing completed for item: ${itemId}`);
    } catch (error) {
      logger.error(
        `Failed to process article metadata for item ${itemId}:`,
        error
      );

      // Update item status to failed
      await Item.findByIdAndUpdate(itemId, {
        status: "failed",
      });
    }
  }
}

export const itemService = new ItemService();
