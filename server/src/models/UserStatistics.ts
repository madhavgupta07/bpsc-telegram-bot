import { Schema, model, type InferSchemaType } from 'mongoose';

const topicPerformanceSchema = new Schema(
  {
    topic: {
      type: String,
      required: true,
    },
    total: {
      type: Number,
      default: 0,
    },
    correct: {
      type: Number,
      default: 0,
    },
  },
  {
    _id: false,
  }
);

const userStatisticsSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    totalQuizzes: {
      type: Number,
      default: 0,
    },
    totalQuestions: {
      type: Number,
      default: 0,
    },
    correctAnswers: {
      type: Number,
      default: 0,
    },
    wrongAnswers: {
      type: Number,
      default: 0,
    },
    accuracy: {
      type: Number,
      default: 0,
    },
    currentStreak: {
      type: Number,
      default: 0,
    },
    longestStreak: {
      type: Number,
      default: 0,
    },
    topicPerformance: {
      type: [topicPerformanceSchema],
      default: [],
    },
    lastQuizDate: {
      type: String,
      default: null,
    },
    lastActiveAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

export type UserStatisticsType = InferSchemaType<typeof userStatisticsSchema> & {
  _id: string;
  createdAt: Date;
  updatedAt: Date;
};

export const UserStatistics = model<typeof userStatisticsSchema>('UserStatistics', userStatisticsSchema);
