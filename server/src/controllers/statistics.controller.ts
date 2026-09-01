import type { Request, Response } from 'express';

import { User } from '../models/User';
import { UserStatistics } from '../models/UserStatistics';
import { DailyQuiz } from '../models/DailyQuiz';
import { QuizSession } from '../models/QuizSession';
import { Question } from '../models/Question';
import { asyncHandler } from '../utils/asyncHandler';
import { getDateKey } from '../utils/date';

export const getDashboardStats = asyncHandler(async (_req: Request, res: Response) => {
  const today = getDateKey();

  const [totalUsers, activeUsers, todayQuiz, totalQuestions, completedSessions] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ isActive: true }),
    DailyQuiz.findOne({ date: today }).lean(),
    Question.countDocuments({ isActive: true }),
    QuizSession.countDocuments({ status: 'COMPLETED' }),
  ]);

  const agg = await UserStatistics.aggregate([
    {
      $group: {
        _id: null,
        totalQuizzes: { $sum: '$totalQuizzes' },
        totalQuestions: { $sum: '$totalQuestions' },
        correctAnswers: { $sum: '$correctAnswers' },
        currentStreakSum: { $sum: '$currentStreak' },
        longestStreakMax: { $max: '$longestStreak' },
      },
    },
  ]);

  const totals = agg[0];
  const averageAccuracy =
    totals && totals.totalQuestions > 0
      ? Math.round((totals.correctAnswers / totals.totalQuestions) * 10000) / 100
      : 0;
  const averageScore =
    totals && totals.totalQuizzes > 0
      ? Math.round((totals.correctAnswers / totals.totalQuizzes) * 100) / 100
      : 0;

  res.json({
    success: true,
    data: {
      totalUsers,
      activeUsers,
      todayQuizStatus: todayQuiz?.status ?? null,
      totalQuestions,
      quizParticipation: completedSessions,
      totalQuizCompletions: totals?.totalQuizzes ?? 0,
      averageScore,
      averageAccuracy,
      currentStreakSum: totals?.currentStreakSum ?? 0,
      longestStreak: totals?.longestStreakMax ?? 0,
    },
  });
});

export const getUserStats = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const stats = await UserStatistics.findOne({ user: id }).lean();
  res.json({ success: true, data: stats });
});

export const getTopUsers = asyncHandler(async (_req: Request, res: Response) => {
  const top = await UserStatistics.find()
    .sort({ correctAnswers: -1 })
    .limit(10)
    .populate('user', 'telegramUsername firstName telegramId')
    .lean();

  const data = top.map((s, idx) => ({
    rank: idx + 1,
    telegramUsername: (s.user as any)?.telegramUsername ?? null,
    firstName: (s.user as any)?.firstName ?? null,
    totalQuizzes: s.totalQuizzes,
    correctAnswers: s.correctAnswers,
    accuracy: s.accuracy,
    currentStreak: s.currentStreak,
  }));

  res.json({ success: true, data });
});

export const getLeaderboard = asyncHandler(async (req: Request, res: Response) => {
  const criteria = typeof req.query.criteria === 'string' ? req.query.criteria : 'accuracy';
  const limit = Math.min(Number(req.query.limit ?? 20), 100);

  const sortMap: Record<string, Record<string, 1 | -1>> = {
    score: { correctAnswers: -1 },
    accuracy: { accuracy: -1 },
    streak: { currentStreak: -1 },
    quizzes: { totalQuizzes: -1 },
  };

  const sort = sortMap[criteria] ?? sortMap.accuracy;

  const list = await UserStatistics.find()
    .sort(sort)
    .limit(limit)
    .populate('user', 'telegramUsername firstName')
    .lean();

  const data = list.map((s, idx) => ({
    rank: idx + 1,
    telegramUsername: (s.user as any)?.telegramUsername ?? null,
    firstName: (s.user as any)?.firstName ?? null,
    totalQuizzes: s.totalQuizzes,
    correctAnswers: s.correctAnswers,
    accuracy: s.accuracy,
    currentStreak: s.currentStreak,
  }));

  res.json({ success: true, data });
});
