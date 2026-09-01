import { Schema, model, type InferSchemaType, type Types } from 'mongoose';

import { DIFFICULTIES, QuestionSource } from '../config/constants';

const questionSchema = new Schema(
  {
    question: {
      type: String,
      required: true,
      trim: true,
    },
    options: {
      type: [String],
      required: true,
      validate: {
        validator: (v: string[]) => Array.isArray(v) && v.length === 4,
        message: 'A question must have exactly 4 options',
      },
    },
    correctAnswer: {
      type: String,
      required: true,
    },
    explanation: {
      type: String,
      required: true,
    },
    topic: {
      type: String,
      required: true,
      index: true,
    },
    subtopic: {
      type: String,
      default: '',
    },
    difficulty: {
      type: String,
      enum: DIFFICULTIES,
      required: true,
      index: true,
    },
    source: {
      type: String,
      enum: Object.values(QuestionSource),
      default: QuestionSource.AI,
    },
    aiModel: {
      type: String,
      default: null,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    usedCount: {
      type: Number,
      default: 0,
    },
    lastUsedAt: {
      type: Date,
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

questionSchema.index({ topic: 1, difficulty: 1 });
questionSchema.index({ question: 'text' });

export type QuestionType = InferSchemaType<typeof questionSchema> & {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

export const Question = model<typeof questionSchema>('Question', questionSchema);
