import { Schema, model, type InferSchemaType } from 'mongoose';

import { SessionStatus } from '../config/constants';

const quizAnswerSchema = new Schema(
  {
    question: {
      type: Schema.Types.ObjectId,
      ref: 'Question',
      required: true,
    },
    selectedAnswer: {
      type: String,
      default: null,
    },
    correctAnswer: {
      type: String,
      required: true,
    },
    isCorrect: {
      type: Boolean,
      default: false,
    },
    answeredAt: {
      type: Date,
      default: null,
    },
  },
  {
    _id: true,
  }
);

export type QuizAnswerType = InferSchemaType<typeof quizAnswerSchema> & { _id: string };

const quizSessionSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    dailyQuiz: {
      type: Schema.Types.ObjectId,
      ref: 'DailyQuiz',
      required: true,
      index: true,
    },
    answers: {
      type: [quizAnswerSchema],
      default: [],
    },
    score: {
      type: Number,
      default: 0,
    },
    totalQuestions: {
      type: Number,
      default: 0,
    },
    currentQuestion: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: Object.values(SessionStatus),
      default: SessionStatus.NOT_STARTED,
      index: true,
    },
    startedAt: {
      type: Date,
      default: null,
    },
    completedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

quizSessionSchema.index({ user: 1, dailyQuiz: 1 }, { unique: true });

export type QuizSessionType = InferSchemaType<typeof quizSessionSchema> & {
  _id: string;
  createdAt: Date;
  updatedAt: Date;
};

export const QuizSession = model<typeof quizSessionSchema>('QuizSession', quizSessionSchema);
export { quizAnswerSchema };
export type QuizAnswerDocument = InstanceType<typeof QuizSession> extends never
  ? never
  : InstanceType<typeof QuizSession>;
