import mongoose, { Document, Schema } from "mongoose";

/**
 * ProductUser - stored in MongoDB
 * Only contains clerkUserId, timestamps are handled by Mongoose
 */
export interface IProductUser extends Document {
  clerkUserId: string;
  createdAt: Date;
  updatedAt: Date;
}

const ProductUserSchema: Schema = new Schema(
  {
    clerkUserId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
  },
  {
    timestamps: true,
    collection: "productusers", // Explicitly set collection name
  }
);

// Ensure clerkUserId is unique
ProductUserSchema.index({ clerkUserId: 1 }, { unique: true });

export default mongoose.model<IProductUser>("ProductUser", ProductUserSchema);

