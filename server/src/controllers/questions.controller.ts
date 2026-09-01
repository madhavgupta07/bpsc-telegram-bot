import type { Request, Response } from 'express';

import { Question } from '../models/Question';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../utils/ApiError';
import { QuestionSource, type Difficulty } from '../config/constants';

interface ListQuery {
  page: number;
  limit: number;
  search?: string;
  topic?: string;
  difficulty?: Difficulty;
  verified?: 'true' | 'false';
}

export const listQuestions = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit, search, topic, difficulty, verified } = req.query as unknown as ListQuery;

  const filter: Record<string, unknown> = {};
  if (search) {
    filter.$or = [
      { question: { $regex: search, $options: 'i' } },
      { topic: { $regex: search, $options: 'i' } },
      { subtopic: { $regex: search, $options: 'i' } },
    ];
  }
  if (topic) filter.topic = topic;
  if (difficulty) filter.difficulty = difficulty;
  if (verified) filter.isVerified = verified === 'true';

  const [total, questions] = await Promise.all([
    Question.countDocuments(filter),
    Question.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
  ]);

  const data = questions.map((q) => ({
    id: String(q._id),
    question: q.question,
    options: q.options,
    correctAnswer: q.correctAnswer,
    explanation: q.explanation,
    topic: q.topic,
    subtopic: q.subtopic,
    difficulty: q.difficulty,
    source: q.source,
    aiModel: q.aiModel,
    isVerified: q.isVerified,
    usedCount: q.usedCount,
    isActive: q.isActive,
    createdAt: q.createdAt,
    updatedAt: q.updatedAt,
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

export const getQuestion = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const q = await Question.findById(id).lean();
  if (!q) throw new AppError('Question not found', 404, 'NOT_FOUND');

  res.json({
    success: true,
    data: {
      id: String(q._id),
      question: q.question,
      options: q.options,
      correctAnswer: q.correctAnswer,
      explanation: q.explanation,
      topic: q.topic,
      subtopic: q.subtopic,
      difficulty: q.difficulty,
      source: q.source,
      aiModel: q.aiModel,
      isVerified: q.isVerified,
      usedCount: q.usedCount,
      isActive: q.isActive,
      createdAt: q.createdAt,
      updatedAt: q.updatedAt,
    },
  });
});

export const createQuestion = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body;

  const existing = await Question.findOne({ question: body.question.trim() }).lean();
  if (existing) throw new AppError('Question already exists', 409, 'CONFLICT');

  const question = await Question.create({
    question: body.question.trim(),
    options: body.options.map((o: string) => o.trim()),
    correctAnswer: body.correctAnswer.trim(),
    explanation: body.explanation.trim(),
    topic: body.topic.trim(),
    subtopic: body.subtopic?.trim() ?? '',
    difficulty: body.difficulty,
    source: QuestionSource.MANUAL,
    isVerified: body.isVerified ?? false,
  });

  res.status(201).json({ success: true, data: { id: String(question._id) } });
});

export const updateQuestion = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const body = req.body;

  const question = await Question.findById(id);
  if (!question) throw new AppError('Question not found', 404, 'NOT_FOUND');

  if (body.question !== undefined) question.question = body.question.trim();
  if (body.options !== undefined) question.options = body.options.map((o: string) => o.trim());
  if (body.correctAnswer !== undefined) question.correctAnswer = body.correctAnswer.trim();
  if (body.explanation !== undefined) question.explanation = body.explanation.trim();
  if (body.topic !== undefined) question.topic = body.topic.trim();
  if (body.subtopic !== undefined) question.subtopic = body.subtopic.trim();
  if (body.difficulty !== undefined) question.difficulty = body.difficulty;
  if (body.isVerified !== undefined) question.isVerified = body.isVerified;

  if (question.correctAnswer && !question.options.includes(question.correctAnswer)) {
    throw new AppError('correctAnswer must be one of the options', 400, 'VALIDATION_ERROR');
  }

  await question.save();
  res.json({ success: true, data: { id: String(question._id) } });
});

export const deleteQuestion = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const question = await Question.findById(id);
  if (!question) throw new AppError('Question not found', 404, 'NOT_FOUND');

  question.isActive = false;
  await question.save();

  res.json({ success: true, message: 'Question deactivated' });
});

export const verifyQuestion = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const question = await Question.findById(id);
  if (!question) throw new AppError('Question not found', 404, 'NOT_FOUND');

  question.isVerified = true;
  await question.save();

  res.json({ success: true, data: { id: String(question._id), isVerified: true } });
});
