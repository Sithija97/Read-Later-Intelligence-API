import mongoose, { Schema, Document, Model } from "mongoose";

type ItemStatus = "created" | "processing" | "ready" | "failed";
type ItemDifficulty = "easy" | "medium" | "hard";

interface IItem {
  url: string;
  title?: string;
  source?: string;
  wordCount?: number;
  readingTimeMinutes?: number;
  difficulty?: ItemDifficulty;
  summary?: string[];
  content?: string;
  status: ItemStatus;
  isCompleted: boolean;
  isSkimmed: boolean;
  savedAt: Date;
  clerkUserId: string;
  createdAt?: Date;
  updatedAt?: Date;
}

interface ItemDocument extends Document, IItem {
  markAsCompleted(): Promise<ItemDocument>;
  updateStatus(newStatus: ItemStatus): Promise<ItemDocument>;
}

interface ItemModel extends Model<ItemDocument> {
  findByStatus(status: ItemStatus): Promise<ItemDocument[]>;
  findUnread(): Promise<ItemDocument[]>;
}

const itemSchema: Schema<ItemDocument, ItemModel> = new Schema(
  {
    clerkUserId: {
      type: String,
      required: [true, "Owner (clerkUserId) is required"],
      index: true,
      trim: true,
    },
    url: {
      type: String,
      required: [true, "URL is required"],
      trim: true,
      validate: {
        validator: function (v: string) {
          try {
            const u = new URL(v);
            return u.protocol === "http:" || u.protocol === "https:";
          } catch {
            return false;
          }
        },
        message: "Please provide a valid URL",
      },
    },
    title: {
      type: String,
      trim: true,
      maxlength: [500, "Title cannot exceed 500 characters"],
    },
    source: {
      type: String,
      trim: true,
    },
    wordCount: {
      type: Number,
      min: [0, "Word count cannot be negative"],
    },
    readingTimeMinutes: {
      type: Number,
      min: [0, "Reading time cannot be negative"],
    },
    difficulty: {
      type: String,
      enum: {
        values: ["easy", "medium", "hard"],
        message: "{VALUE} is not a valid difficulty level",
      },
      default: "easy",
    },
    summary: {
      type: [String],
      default: [],
    },
    content: {
      type: String,
    },
    status: {
      type: String,
      enum: {
        values: ["created", "processing", "ready", "failed"],
        message: "{VALUE} is not a valid status",
      },
      default: "created",
      index: true,
    },
    isCompleted: {
      type: Boolean,
      default: false,
      index: true,
    },
    isSkimmed: {
      type: Boolean,
      default: false,
    },
    savedAt: {
      type: Date,
      default: Date.now,
      index: -1,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// Indexes
itemSchema.index({ clerkUserId: 1, url: 1 }, { unique: true });
itemSchema.index({ status: 1 });
itemSchema.index({ savedAt: -1 });
itemSchema.index({ isCompleted: 1 });

// Derive fields before save
itemSchema.pre("save", async function (this: ItemDocument) {
  if (!this.source && this.url) {
    try {
      const u = new URL(this.url);
      this.source = u.hostname;
    } catch {
      // ignore; validator will catch invalid url
    }
  }
  if (typeof this.wordCount === "number" && this.wordCount >= 0) {
    this.readingTimeMinutes = Math.max(0, Math.ceil(this.wordCount / 200));
  }
});

// Methods
itemSchema.methods.markAsCompleted = function (): Promise<ItemDocument> {
  this.isCompleted = true;
  this.isSkimmed = true;
  return this.save();
};

itemSchema.methods.updateStatus = function (
  newStatus: ItemStatus
): Promise<ItemDocument> {
  const validStatuses: ItemStatus[] = [
    "created",
    "processing",
    "ready",
    "failed",
  ];
  if (!validStatuses.includes(newStatus)) {
    throw new Error(`Invalid status: ${newStatus}`);
  }
  this.status = newStatus;
  return this.save();
};

// Statics
itemSchema.statics.findByStatus = function (
  status: ItemStatus
): Promise<ItemDocument[]> {
  return this.find({ status }).exec();
};

itemSchema.statics.findUnread = function (): Promise<ItemDocument[]> {
  return this.find({ isCompleted: false }).exec();
};

const Item = mongoose.model<ItemDocument, ItemModel>("Item", itemSchema);
export default Item;
