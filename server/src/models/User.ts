import { Schema, model, type InferSchemaType } from 'mongoose';

const userSchema = new Schema(
  {
    telegramId: {
      type: Number,
      required: true,
      unique: true,
      index: true,
    },
    telegramUsername: {
      type: String,
      trim: true,
      default: null,
    },
    firstName: {
      type: String,
      trim: true,
      default: null,
    },
    lastName: {
      type: String,
      trim: true,
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isSubscribed: {
      type: Boolean,
      default: true,
    },
    blockedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

export type UserType = InferSchemaType<typeof userSchema> & {
  _id: string;
  createdAt: Date;
  updatedAt: Date;
};

export const User = model<typeof userSchema>('User', userSchema);
