import type { FilterQuery } from 'mongoose';

import { Question, type QuestionType } from '../models/Question';
import { DailyQuiz } from '../models/DailyQuiz';
import { UserStatistics } from '../models/UserStatistics';
import { logger } from '../utils/logger';
import { AppError } from '../utils/ApiError';
import { getDateKey, addDaysToDateKey } from '../utils/date';
import {
  DEFAULT_DIFFICULTY_DISTRIBUTION,
  DEFAULT_QUESTIONS_PER_QUIZ,
  QuizStatus,
  type DifficultyDistribution,
  type QuizTopicDistribution,
} from '../config/constants';

export interface QuizGenerationConfig {
  totalQuestions?: number;
  topicDistribution?: QuizTopicDistribution;
  difficultyDistribution?: DifficultyDistribution;
}

export interface SelectedQuestion {
  question: QuestionType;
  weight: number;
}

function normalizeDistribution(
  input: QuizTopicDistribution,
  total: number
): Array<{ topic: string; count: number }> {
  const entries = Object.entries(input).filter(([, count]) => count > 0);
  const totalWeight = entries.reduce((sum, [, count]) => sum + count, 0);

  if (totalWeight === 0) return [];

  const result = entries.map(([topic, count]) => ({
    topic,
    count: Math.round((count / totalWeight) * total),
  }));

  const allocated = result.reduce((sum, r) => sum + r.count, 0);
  let diff = total - allocated;

  let i = 0;
  while (diff !== 0 && result.length > 0) {
    result[i % result.length].count += diff > 0 ? 1 : -1;
    if (result[i % result.length].count < 0) result[i % result.length].count = 0;
    diff = total - result.reduce((sum, r) => sum + r.count, 0);
    i++;
  }

  return result.filter((r) => r.count > 0);
}

function pickTopQuestions(
  candidates: QuestionType[],
  count: number,
  difficultyDistribution: DifficultyDistribution
): QuestionType[] {
  if (candidates.length <= count) return candidates;

  const easyTarget = Math.round(count * difficultyDistribution.easy);
  const hardTarget = Math.round(count * difficultyDistribution.hard);

  const easy = candidates.filter((c) => c.difficulty === 'easy').slice(0, easyTarget);
  const hard = candidates.filter((c) => c.difficulty === 'hard').slice(0, hardTarget);
  const mediumNeeded = count - easy.length - hard.length;
  const medium = candidates
    .filter((c) => c.difficulty === 'medium' && !easy.includes(c) && !hard.includes(c))
    .slice(0, mediumNeeded);

  const selected = [...easy, ...medium, ...hard];

  if (selected.length < count) {
    const usedIds = new Set(selected.map((s) => String(s._id)));
    const fill = candidates
      .filter((c) => !usedIds.has(String(c._id)))
      .slice(0, count - selected.length);
    selected.push(...fill);
  }

  return selected;
}

export async function selectQuestionsForQuiz(
  topicDistribution: QuizTopicDistribution,
  config: QuizGenerationConfig,
  excludeQuestionIds: string[] = [],
  weakTopics: string[] = []
): Promise<QuestionType[]> {
  const total = config.totalQuestions ?? DEFAULT_QUESTIONS_PER_QUIZ;
  const difficultyDistribution = config.difficultyDistribution ?? DEFAULT_DIFFICULTY_DISTRIBUTION;

  const distribution = normalizeDistribution(topicDistribution, total);
  if (distribution.length === 0) {
    throw new AppError('No topics configured for quiz generation', 400, 'QUIZ_GENERATION_FAILED');
  }

  const excluded = new Set(excludeQuestionIds);

  const selected: QuestionType[] = [];

  for (const { topic, count } of distribution) {
    if (count <= 0) continue;

    const query: FilterQuery<QuestionType> = {
      topic,
      isActive: true,
      usedCount: { $lt: 10 },
    };

    if (excluded.size > 0) {
      query._id = { $nin: [...excluded] };
    }

    const candidates = await Question.find(query)
      .sort({ usedCount: 1, lastUsedAt: 1, _id: -1 })
      .limit(count * 30)
      .lean();

    let pool: QuestionType[] = candidates;

    if (weakTopics.includes(topic) && candidates.length > count * 3) {
      pool = shuffle(candidates);
    } else if (candidates.length > count * 2) {
      pool = candidates.slice(0, count * 2);
    }

    const chosen = pickTopQuestions(pool, count, difficultyDistribution);

    for (const q of chosen) {
      selected.push(q);
      excluded.add(String(q._id));
    }
  }

  if (selected.length < total) {
    logger.warn(
      `Quiz selection underfilled: got ${selected.length}/${total} questions. Filling with fallback questions.`
    );
    const fallback = await Question.find({
      isActive: true,
      _id: { $nin: [...excluded] },
    })
      .sort({ usedCount: 1, lastUsedAt: 1 })
      .limit(total - selected.length)
      .lean();
    selected.push(...fallback);
  }

  if (selected.length === 0) {
    throw new AppError(
      'No questions available for quiz generation. Generate questions first.',
      404,
      'QUIZ_GENERATION_FAILED'
    );
  }

  return selected;
}

export async function createDailyQuiz(
  dateKey: string,
  questions: QuestionType[],
  topicDistribution: QuizTopicDistribution
): Promise<{ quiz: any; created: boolean }> {
  const existing = await DailyQuiz.findOne({ date: dateKey });
  if (existing) {
    logger.info(`DailyQuiz for ${dateKey} already exists, skipping creation.`);
    return { quiz: existing, created: false };
  }

  const quiz = await DailyQuiz.create({
    date: dateKey,
    questions: questions.map((q) => q._id),
    topicDistribution,
    totalQuestions: questions.length,
    status: QuizStatus.PUBLISHED,
    validationStatus: 'VALIDATED',
  });

  logger.info(`DailyQuiz created for ${dateKey} with ${questions.length} questions`);
  return { quiz, created: true };
}

export async function findActiveQuizForDate(dateKey: string) {
  return DailyQuiz.findOne({ date: dateKey, status: QuizStatus.PUBLISHED })
    .populate('questions')
    .lean();
}

export async function markQuestionsUsed(questionIds: string[]): Promise<void> {
  await Question.updateMany(
    { _id: { $in: questionIds } },
    { $inc: { usedCount: 1 }, $set: { lastUsedAt: new Date() } }
  );
}

export async function getRecentQuestionIds(days = 7): Promise<string[]> {
  const startKey = addDaysToDateKey(getDateKey(), -days);
  const quizzes = await DailyQuiz.find({ date: { $gte: startKey } })
    .select('questions')
    .lean();

  const ids = new Set<string>();
  for (const q of quizzes) {
    for (const questionId of (q.questions ?? []) as unknown as string[]) {
      ids.add(String(questionId));
    }
  }
  return [...ids].slice(0, 2000);
}

export async function getWeakTopics(userId: string, limit = 3): Promise<string[]> {
  const stats = await UserStatistics.findOne({ user: userId }).lean();
  if (!stats || stats.topicPerformance.length === 0) return [];

  const sorted = [...stats.topicPerformance].sort((a, b) => {
    const accA = a.total > 0 ? a.correct / a.total : 1;
    const accB = b.total > 0 ? b.correct / b.total : 1;
    return accA - accB;
  });

  return sorted
    .filter((t) => t.total >= 3 && t.correct / t.total < 0.75)
    .slice(0, limit)
    .map((t) => t.topic);
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
