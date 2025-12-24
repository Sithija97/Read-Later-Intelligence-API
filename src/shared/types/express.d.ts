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
 * Request with authenticated ProductUser (from attachUser middleware)
 * Used for protected routes that require an existing local ProductUser
 */
export interface UserRequest extends Request {
  user: IProductUser;
}

