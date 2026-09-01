import { Schema, model, type InferSchemaType } from 'mongoose';

import { QuizStatus } from '../config/constants';

const dailyQuizSchema = new Schema(
  {
    date: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    questions: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Question',
      },
    ],
    topicDistribution: {
      type: Map,
      of: Number,
      default: {},
    },
    totalQuestions: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: Object.values(QuizStatus),
      default: QuizStatus.DRAFT,
    },
    generationError: {
      type: String,
      default: null,
    },
    validationStatus: {
      type: String,
      enum: ['PENDING', 'VALIDATED', 'FAILED'],
      default: 'PENDING',
    },
  },
  {
    timestamps: true,
  }
);

export type DailyQuizType = InferSchemaType<typeof dailyQuizSchema> & {
  _id: string;
  createdAt: Date;
  updatedAt: Date;
};

export const DailyQuiz = model<typeof dailyQuizSchema>('DailyQuiz', dailyQuizSchema);
