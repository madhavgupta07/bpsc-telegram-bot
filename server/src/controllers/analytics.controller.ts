import type { Request, Response } from 'express';

import { QuizSession } from '../models/QuizSession';
import { UserStatistics } from '../models/UserStatistics';
import { Question } from '../models/Question';
import { asyncHandler } from '../utils/asyncHandler';
import { addDaysToDateKey, getDateKey } from '../utils/date';

export const getDailyParticipation = asyncHandler(async (req: Request, res: Response) => {
  const days = Math.min(Number(req.query.days ?? 30), 90);

  const sessions = await QuizSession.find({
    status: 'COMPLETED',
    completedAt: { $ne: null },
  })
    .select('completedAt score')
    .lean();

  const today = new Date();
  const buckets = new Map<string, { count: number; totalScore: number; sessions: number }>();

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    const key = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' })
      .format(d)
      .replace(/\//g, '-');
    buckets.set(key, { count: 0, totalScore: 0, sessions: 0 });
  }

  for (const s of sessions) {
    const key = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' })
      .format(new Date(s.completedAt!))
      .replace(/\//g, '-');
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.count += 1;
      bucket.sessions += 1;
      bucket.totalScore += s.score ?? 0;
    }
  }

  const data = [...buckets.entries()].map(([date, b]) => ({
    date,
    participants: b.count,
    averageScore: b.sessions > 0 ? Math.round((b.totalScore / b.sessions) * 100) / 100 : 0,
  }));

  res.json({ success: true, data });
});

export const getTopicPerformance = asyncHandler(async (_req: Request, res: Response) => {
  const stats = await UserStatistics.find()
    .select('topicPerformance')
    .lean();

  const topicMap = new Map<string, { total: number; correct: number }>();
  for (const s of stats) {
    for (const tp of s.topicPerformance ?? []) {
      const cur = topicMap.get(tp.topic) ?? { total: 0, correct: 0 };
      cur.total += tp.total;
      cur.correct += tp.correct;
      topicMap.set(tp.topic, cur);
    }
  }

  const data = [...topicMap.entries()]
    .filter(([, v]) => v.total > 0)
    .map(([topic, v]) => ({
      topic,
      total: v.total,
      correct: v.correct,
      accuracy: Math.round((v.correct / v.total) * 100),
    }))
    .sort((a, b) => a.accuracy - b.accuracy);

  res.json({ success: true, data });
});

export const getQuestionPerformance = asyncHandler(async (_req: Request, res: Response) => {
  const questions = await Question.aggregate([
    {
      $lookup: {
        from: 'quizsessions',
        let: { qid: '$_id' },
        pipeline: [
          { $match: { $expr: { $in: ['$$qid', '$answers.question'] } } },
          { $unwind: '$answers' },
          { $match: { $expr: { $eq: ['$answers.question', '$$qid'] } } },
          { $project: { _id: 0, isCorrect: '$answers.isCorrect' } },
        ],
        as: 'attempts',
      },
    },
    {
      $project: {
        question: 1,
        topic: 1,
        difficulty: 1,
        attemptCount: { $size: '$attempts' },
        correctCount: {
          $size: {
            $filter: { input: '$attempts', as: 'a', cond: { $eq: ['$$a.isCorrect', true] } },
          },
        },
      },
    },
    { $match: { attemptCount: { $gt: 0 } } },
    { $sort: { attemptCount: -1 } },
    { $limit: 50 },
  ]);

  const data = questions.map((q) => ({
    id: String(q._id),
    question: q.question,
    topic: q.topic,
    difficulty: q.difficulty,
    attemptCount: q.attemptCount,
    correctCount: q.correctCount,
    accuracy: q.attemptCount > 0 ? Math.round((q.correctCount / q.attemptCount) * 100) : 0,
  }));

  res.json({ success: true, data });
});

export const getRangeStats = asyncHandler(async (req: Request, res: Response) => {
  const days = Math.min(Number(req.query.days ?? 7), 90);
  const sinceKey = addDaysToDateKey(getDateKey(), -days);

  const [totalUsers, sessionCount, newQuestions] = await Promise.all([
    UserStatistics.countDocuments({ lastQuizDate: { $gte: sinceKey } }),
    QuizSession.countDocuments({ status: 'COMPLETED', completedAt: { $gte: new Date(Date.now() - days * 86400000) } }),
    Question.countDocuments({ createdAt: { $gte: new Date(Date.now() - days * 86400000) } }),
  ]);

  res.json({
    success: true,
    data: {
      activeUsersLastNDays: totalUsers,
      sessionsLastNDays: sessionCount,
      newQuestionsLastNDays: newQuestions,
      days,
    },
  });
});
