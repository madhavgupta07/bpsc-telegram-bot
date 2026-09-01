import { Schema, model, type InferSchemaType } from 'mongoose';

const adminSchema = new Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    name: {
      type: String,
      default: '',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastLoginAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

export type AdminType = InferSchemaType<typeof adminSchema> & {
  _id: string;
  createdAt: Date;
  updatedAt: Date;
};

export const Admin = model<typeof adminSchema>('Admin', adminSchema);
