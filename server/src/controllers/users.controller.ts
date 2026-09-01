import type { Request, Response } from 'express';

import { User } from '../models/User';
import { UserStatistics } from '../models/UserStatistics';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../utils/ApiError';

interface QueryResult {
  data: unknown[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export const listUsers = asyncHandler(async (req: Request, res: Response) => {
  const page = Number(req.query.page ?? 1);
  const limit = Number(req.query.limit ?? 20);
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
  const isSubscribed = req.query.subscribed;

  const filter: Record<string, unknown> = {};
  if (search) {
    filter.$or = [
      { telegramUsername: { $regex: search, $options: 'i' } },
      { firstName: { $regex: search, $options: 'i' } },
      { telegramId: search.match(/^\d+$/) ? Number(search) : undefined },
    ].filter((f) => f.telegramId !== undefined || f.telegramUsername !== undefined || f.firstName !== undefined);
  }
  if (isSubscribed === 'true') filter.isSubscribed = true;
  if (isSubscribed === 'false') filter.isSubscribed = false;

  const [total, users] = await Promise.all([
    User.countDocuments(filter),
    User.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
  ]);

  const userIds = users.map((u) => String(u._id));
  const statsMap = new Map<string, any>();
  if (userIds.length > 0) {
    const stats = await UserStatistics.find({ user: { $in: userIds } }).lean();
    for (const s of stats) {
      statsMap.set(String(s.user), s);
    }
  }

  const data = users.map((u) => {
    const st = statsMap.get(String(u._id));
    return {
      id: String(u._id),
      telegramId: u.telegramId,
      telegramUsername: u.telegramUsername,
      firstName: u.firstName,
      lastName: u.lastName,
      isActive: u.isActive,
      isSubscribed: u.isSubscribed,
      totalQuizzes: st?.totalQuizzes ?? 0,
      totalQuestions: st?.totalQuestions ?? 0,
      accuracy: st?.accuracy ?? 0,
      currentStreak: st?.currentStreak ?? 0,
      longestStreak: st?.longestStreak ?? 0,
      lastActiveAt: st?.lastActiveAt ?? null,
      createdAt: u.createdAt,
    };
  });

  const result: QueryResult = {
    data,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
  res.json({ success: true, data: result });
});

export const getUserDetail = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = await User.findById(id).lean();
  if (!user) throw new AppError('User not found', 404, 'NOT_FOUND');

  const stats = await UserStatistics.findOne({ user: id }).lean();

  res.json({
    success: true,
    data: {
      id: String(user._id),
      telegramId: user.telegramId,
      telegramUsername: user.telegramUsername,
      firstName: user.firstName,
      lastName: user.lastName,
      isActive: user.isActive,
      isSubscribed: user.isSubscribed,
      createdAt: user.createdAt,
      statistics: stats ?? null,
    },
  });
});

export const toggleUserActive = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = await User.findById(id);
  if (!user) throw new AppError('User not found', 404, 'NOT_FOUND');

  user.isActive = !user.isActive;
  if (!user.isActive) user.blockedAt = new Date();
  else user.blockedAt = null;
  await user.save();

  res.json({ success: true, data: { id: String(user._id), isActive: user.isActive } });
});

export const toggleUserSubscription = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = await User.findById(id);
  if (!user) throw new AppError('User not found', 404, 'NOT_FOUND');

  user.isSubscribed = !user.isSubscribed;
  await user.save();

  res.json({ success: true, data: { id: String(user._id), isSubscribed: user.isSubscribed } });
});
