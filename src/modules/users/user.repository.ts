import ProductUser, { IProductUser } from "./user.model";

/**
 * User repository - handles all database operations for ProductUser
 */
export class UserRepository {
  /**
   * Find a ProductUser by clerkUserId
   */
  async findByClerkId(clerkUserId: string): Promise<IProductUser | null> {
    return await ProductUser.findOne({ clerkUserId });
  }

  /**
   * Create a new ProductUser
   */
  async create(clerkUserId: string): Promise<IProductUser> {
    const productUser = new ProductUser({ clerkUserId });
    return await productUser.save();
  }

  /**
   * Find or create a ProductUser by clerkUserId
   */
  async findOrCreate(clerkUserId: string): Promise<{
    productUser: IProductUser;
    isNew: boolean;
  }> {
    let productUser = await this.findByClerkId(clerkUserId);
    let isNew = false;

    if (!productUser) {
      productUser = await this.create(clerkUserId);
      isNew = true;
    }

    return { productUser, isNew };
  }
}

// Export singleton instance
export const userRepository = new UserRepository();

