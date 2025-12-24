import { userRepository } from "../users/user.repository";
import { IProductUser } from "../users/user.model";

/**
 * Auth service - handles authentication business logic
 */
export class AuthService {
  /**
   * Sync ProductUser - find or create user in database
   */
  async syncProductUser(clerkUserId: string): Promise<{
    productUser: IProductUser;
    isNew: boolean;
  }> {
    return await userRepository.findOrCreate(clerkUserId);
  }

  /**
   * Get ProductUser by clerkUserId
   */
  async getProductUserByClerkId(clerkUserId: string): Promise<IProductUser | null> {
    return await userRepository.findByClerkId(clerkUserId);
  }
}

// Export singleton instance
export const authService = new AuthService();

