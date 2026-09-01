import { z } from 'zod';

import { DIFFICULTIES } from '../config/constants';

export const loginSchema = z.object({
  body: z.object({
    username: z.string().min(1, 'Username is required').max(50),
    password: z.string().min(1, 'Password is required').max(100),
  }),
});

export const createQuestionSchema = z.object({
  body: z
    .object({
      question: z.string().min(10, 'Question must be at least 10 characters').max(1000),
      options: z
        .array(z.string().min(1).max(500))
        .length(4, 'Exactly 4 options required'),
      correctAnswer: z.string().min(1).max(500),
      explanation: z.string().min(5, 'Explanation must be at least 5 characters').max(2000),
      topic: z.string().min(1).max(200),
      subtopic: z.string().max(200).optional().default(''),
      difficulty: z.enum(DIFFICULTIES),
      isVerified: z.boolean().optional().default(false),
    })
    .refine((data) => data.options.includes(data.correctAnswer), {
      message: 'correctAnswer must be one of the provided options',
      path: ['correctAnswer'],
    }),
});

export const updateQuestionSchema = createQuestionSchema.partial();

export const listQuestionsQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(20),
    search: z.string().optional(),
    topic: z.string().optional(),
    difficulty: z.enum(DIFFICULTIES).optional(),
    verified: z.enum(['true', 'false']).optional(),
  }),
});

export const createTopicSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(100),
    description: z.string().max(500).optional().default(''),
    parentTopic: z.string().optional().nullable(),
  }),
});

export const updateTopicSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(100).optional(),
    description: z.string().max(500).optional(),
    parentTopic: z.string().optional().nullable(),
    isActive: z.boolean().optional(),
  }),
});

export const generateQuizSchema = z.object({
  body: z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)').optional(),
    totalQuestions: z.number().int().min(1).max(100).optional().default(10),
    topicDistribution: z.record(z.string(), z.number().int().min(0)).optional(),
    difficultyDistribution: z
      .object({
        easy: z.number().min(0).max(1).optional(),
        medium: z.number().min(0).max(1).optional(),
        hard: z.number().min(0).max(1).optional(),
      })
      .optional(),
    regenerate: z.boolean().optional().default(false),
  }),
});

export const quizParamsSchema = z.object({
  params: z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format'),
  }),
});

export const idParamSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
});

export const paginationQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  }),
});
