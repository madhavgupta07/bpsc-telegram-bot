import type { Request, Response } from 'express';

import { DailyQuiz } from '../models/DailyQuiz';
import { Question } from '../models/Question';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../utils/ApiError';
import {
  DEFAULT_DIFFICULTY_DISTRIBUTION,
  DEFAULT_QUESTIONS_PER_QUIZ,
  DEFAULT_TOPIC_DISTRIBUTION,
  QuizStatus,
} from '../config/constants';
import { getDateKey, addDaysToDateKey } from '../utils/date';
import { generateQuizForDate } from '../services/generation.service';
import { markQuestionsUsed } from '../services/quiz.service';
import { findActiveQuizForDate } from '../services/quiz.service';

export const listQuizzes = asyncHandler(async (req: Request, res: Response) => {
  const page = Number(req.query.page ?? 1);
  const limit = Number(req.query.limit ?? 20);

  const [total, quizzes] = await Promise.all([
    DailyQuiz.countDocuments(),
    DailyQuiz.find()
      .sort({ date: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
  ]);

  const data = quizzes.map((q) => ({
    id: String(q._id),
    date: q.date,
    totalQuestions: q.totalQuestions,
    status: q.status,
    validationStatus: q.validationStatus,
    generationError: q.generationError,
    topicDistribution: q.topicDistribution,
    questionCount: q.questions?.length ?? 0,
    createdAt: q.createdAt,
  }));

  res.json({
    success: true,
    data: {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  });
});

export const getQuiz = asyncHandler(async (req: Request, res: Response) => {
  const { date } = req.params;
  const quiz = await DailyQuiz.findOne({ date }).populate('questions').lean();
  if (!quiz) throw new AppError('Quiz not found for this date', 404, 'QUIZ_NOT_FOUND');

  res.json({
    success: true,
    data: {
      id: String(quiz._id),
      date: quiz.date,
      status: quiz.status,
      validationStatus: quiz.validationStatus,
      questionCount: quiz.questions?.length ?? 0,
      topicDistribution: quiz.topicDistribution,
      questions: (quiz.questions ?? []).map((q: any) => ({
        id: String(q._id),
        question: q.question,
        options: q.options,
        correctAnswer: q.correctAnswer,
        explanation: q.explanation,
        topic: q.topic,
        subtopic: q.subtopic,
        difficulty: q.difficulty,
      })),
    },
  });
});

export const generateQuiz = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as {
    date?: string;
    totalQuestions?: number;
    topicDistribution?: Record<string, number>;
    difficultyDistribution?: Record<string, number>;
    regenerate?: boolean;
  };

  const today = getDateKey();
  const targetDate = body.date ?? addDaysToDateKey(today, 1);

  const existing = await DailyQuiz.findOne({ date: targetDate });
  if (existing && !body.regenerate) {
    throw new AppError(
      'Quiz already exists for this date. Use regenerate to replace it.',
      409,
      'CONFLICT'
    );
  }

  const result = await generateQuizForDate(targetDate, {
    totalQuestions: body.totalQuestions ?? DEFAULT_QUESTIONS_PER_QUIZ,
    topicDistribution: (body.topicDistribution as any) ?? DEFAULT_TOPIC_DISTRIBUTION,
    difficultyDistribution: (body.difficultyDistribution as any) ?? DEFAULT_DIFFICULTY_DISTRIBUTION,
    regenerate: Boolean(body.regenerate),
  });

  res.status(201).json({
    success: true,
    data: {
      id: String(result.quiz._id),
      date: result.quiz.date,
      totalQuestions: result.quiz.totalQuestions,
      status: result.quiz.status,
      validationStatus: result.quiz.validationStatus,
      questionIds: result.quiz.questions.map((q: any) => String(q._id)),
    },
  });
});

export const regenerateQuiz = asyncHandler(async (req: Request, res: Response) => {
  const { date } = req.params;
  const result = await generateQuizForDate(date, {
    totalQuestions: DEFAULT_QUESTIONS_PER_QUIZ,
    topicDistribution: DEFAULT_TOPIC_DISTRIBUTION,
    difficultyDistribution: { ...DEFAULT_DIFFICULTY_DISTRIBUTION },
    regenerate: true,
  });

  res.json({
    success: true,
    data: {
      id: String(result.quiz._id),
      date: result.quiz.date,
      totalQuestions: result.quiz.totalQuestions,
      status: result.quiz.status,
      questionCount: result.quiz.questions?.length ?? 0,
    },
  });
});

export const previewQuiz = asyncHandler(async (req: Request, res: Response) => {
  const { date } = req.params;
  const quiz = await DailyQuiz.findOne({ date }).populate('questions').lean();
  if (!quiz) throw new AppError('Quiz not found', 404, 'QUIZ_NOT_FOUND');

  res.json({
    success: true,
    data: {
      id: String(quiz._id),
      date: quiz.date,
      totalQuestions: quiz.totalQuestions,
      topicDistribution: quiz.topicDistribution,
      questions: (quiz.questions ?? []).map((q: any) => ({
        id: String(q._id),
        question: q.question,
        options: q.options,
        correctAnswer: q.correctAnswer,
        explanation: q.explanation,
        topic: q.topic,
        subtopic: q.subtopic,
        difficulty: q.difficulty,
      })),
    },
  });
});

export const publishQuiz = asyncHandler(async (req: Request, res: Response) => {
  const { date } = req.params;
  const quiz = await DailyQuiz.findOne({ date });
  if (!quiz) throw new AppError('Quiz not found', 404, 'QUIZ_NOT_FOUND');
  if (quiz.status === QuizStatus.COMPLETED) {
    throw new AppError('Cannot publish a completed quiz', 409, 'CONFLICT');
  }

  quiz.status = QuizStatus.PUBLISHED;
  await quiz.save();

  await markQuestionsUsed((quiz.questions as unknown as string[]).map(String));

  res.json({ success: true, data: { id: String(quiz._id), status: quiz.status } });
});

export const unpublishQuiz = asyncHandler(async (req: Request, res: Response) => {
  const { date } = req.params;
  const quiz = await DailyQuiz.findOne({ date });
  if (!quiz) throw new AppError('Quiz not found', 404, 'QUIZ_NOT_FOUND');

  quiz.status = QuizStatus.DRAFT;
  await quiz.save();

  res.json({ success: true, data: { id: String(quiz._id), status: quiz.status } });
});

export const replaceQuestion = asyncHandler(async (req: Request, res: Response) => {
  const { date } = req.params;
  const { oldQuestionId } = req.body as { oldQuestionId?: string };

  if (!oldQuestionId) throw new AppError('oldQuestionId is required', 400, 'BAD_REQUEST');

  const quiz = await DailyQuiz.findOne({ date });
  if (!quiz) throw new AppError('Quiz not found', 404, 'QUIZ_NOT_FOUND');

  const questions = (quiz.questions as unknown as string[]).map(String);
  const idx = questions.indexOf(oldQuestionId);
  if (idx === -1) throw new AppError('Question not part of this quiz', 404, 'NOT_FOUND');

  const currentQuestion = await Question.findById(oldQuestionId).lean();

  const replacement = await Question.findOne({
    _id: { $ne: oldQuestionId, $nin: questions },
    isActive: true,
    topic: currentQuestion?.topic,
    usedCount: { $lt: 10 },
  }).sort({ usedCount: 1, lastUsedAt: 1 });

  if (!replacement) throw new AppError('No replacement question available', 404, 'NOT_FOUND');

  questions[idx] = String(replacement._id);
  quiz.questions = questions as any;
  await quiz.save();

  res.json({ success: true, data: { id: String(quiz._id), replacedWith: replacement._id } });
});

export const getTodaysQuiz = asyncHandler(async (_req: Request, res: Response) => {
  const today = getDateKey();
  const quiz = await findActiveQuizForDate(today);
  res.json({
    success: true,
    data: quiz
      ? {
          id: String(quiz._id),
          date: quiz.date,
          totalQuestions: quiz.totalQuestions,
          status: quiz.status,
          questionCount: quiz.questions?.length ?? 0,
        }
      : null,
  });
});

export const getTomorrowQuizStatus = asyncHandler(async (_req: Request, res: Response) => {
  const tomorrow = addDaysToDateKey(getDateKey(), 1);
  const quiz = await DailyQuiz.findOne({ date: tomorrow }).lean();
  res.json({
    success: true,
    data: quiz
      ? {
          id: String(quiz._id),
          date: quiz.date,
          status: quiz.status,
          validationStatus: quiz.validationStatus,
          questionCount: quiz.questions?.length ?? 0,
        }
      : null,
  });
});
