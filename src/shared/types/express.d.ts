import { Request } from "express";
import { IProductUser } from "../../modules/users/user.model";

/**
 * Identity user from Clerk
 * Contains user identity information from Clerk authentication
 */
export interface IdentityUser {
  clerkUserId: string;
  email: string;
  name?: string;
}

/**
 * Request with Clerk authentication data (from requireClerkAuth middleware)
 * Used for routes that need Clerk identity but not necessarily a local user
 */
export interface AuthRequest extends Request {
  auth: IdentityUser;
}

/**
 * Extended ProductUser with identity info from Clerk
 */
export interface ExtendedProductUser extends IProductUser {
  email: string;
  name?: string;
}

/**
 * Request with authenticated ProductUser + identity info (from attachUser middleware)
 * Used for protected routes that require an existing local ProductUser
 * Includes email and name from Clerk for convenience
 */
export interface UserRequest extends Request {
  user: ExtendedProductUser;
}

