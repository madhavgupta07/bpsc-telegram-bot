import type { Types } from 'mongoose';

import { QuizSession } from '../models/QuizSession';
import { UserStatistics } from '../models/UserStatistics';
import { Question } from '../models/Question';
import { DailyQuiz } from '../models/DailyQuiz';
import { SessionStatus } from '../config/constants';
import { logger } from '../utils/logger';
import { AppError } from '../utils/ApiError';
import { isConsecutiveDay, isSameDay } from '../utils/date';

function dayOf(d: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function yesterdayKey(today: string): string {
  const [y, m, d] = today.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() - 1);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(dt);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export async function getOrCreateSession(
  userId: string,
  dailyQuizId: string
): Promise<import('mongoose').Document & any> {
  let session = await QuizSession.findOne({ user: userId, dailyQuiz: dailyQuizId });
  if (!session) {
    const quiz = await DailyQuiz.findById(dailyQuizId).lean();
    if (!quiz) throw new AppError('Quiz not found', 404, 'QUIZ_NOT_FOUND');

    session = await QuizSession.create({
      user: userId,
      dailyQuiz: dailyQuizId,
      totalQuestions: quiz.totalQuestions ?? quiz.questions.length,
      status: SessionStatus.NOT_STARTED,
    });
  }
  return session;
}

export async function startSession(userId: string, dailyQuizId: string) {
  const session = await getOrCreateSession(userId, dailyQuizId);
  if (session.status === SessionStatus.NOT_STARTED) {
    session.status = SessionStatus.IN_PROGRESS;
    session.startedAt = new Date();
    session.currentQuestion = 0;
    await session.save();
  }
  return session;
}

export interface SubmitAnswerResult {
  session: any;
  alreadyAnswered: boolean;
  isCorrect: boolean;
}

export async function submitAnswer(
  userId: string,
  dailyQuizId: string,
  questionId: string,
  selectedAnswer: string
): Promise<SubmitAnswerResult> {
  const session = await QuizSession.findOne({ user: userId, dailyQuiz: dailyQuizId });
  if (!session) {
    throw new AppError('No active quiz session found. Start a quiz first.', 404, 'QUIZ_NOT_FOUND');
  }

  if (session.status === SessionStatus.COMPLETED) {
    throw new AppError('This quiz session has already been completed.', 400, 'QUIZ_ALREADY_ANSWERED');
  }

  if (session.status === SessionStatus.EXPIRED) {
    throw new AppError('This quiz session has expired.', 400, 'SESSION_EXPIRED');
  }

  const question = await Question.findById(questionId).lean();
  if (!question) throw new AppError('Question not found', 404, 'NOT_FOUND');

  const existing = session.answers.find(
    (a: any) => String(a.question) === String(questionId)
  );

  if (existing) {
    logger.debug('Answer already recorded, returning idempotent response', {
      userId,
      questionId,
    });
    return {
      session,
      alreadyAnswered: true,
      isCorrect: existing.isCorrect ?? false,
    };
  }

  const isCorrect = question.correctAnswer === selectedAnswer;
  const answer = {
    question: question._id as Types.ObjectId,
    selectedAnswer,
    correctAnswer: question.correctAnswer,
    isCorrect,
    answeredAt: new Date(),
  };

  session.answers.push(answer);

  if (isCorrect) {
    session.score += 1;
  }

  session.currentQuestion = Math.min(
    session.answers.length,
    session.totalQuestions
  );

  if (session.answers.length >= session.totalQuestions) {
    session.status = SessionStatus.COMPLETED;
    session.completedAt = new Date();
  }

  await session.save();

  return { session, alreadyAnswered: false, isCorrect };
}

export async function completeSession(userId: string, dailyQuizId: string) {
  const session = await QuizSession.findOne({ user: userId, dailyQuiz: dailyQuizId });
  if (!session) throw new AppError('Session not found', 404, 'NOT_FOUND');

  if (session.status !== SessionStatus.COMPLETED) {
    session.status = SessionStatus.COMPLETED;
    session.completedAt = new Date();
    await session.save();
  }

  await updateUserStatistics(userId, session);
  return session;
}

export async function updateUserStatistics(userId: string, session: any): Promise<void> {
  const correctAnswers = session.answers.filter((a: any) => a.isCorrect).length;
  const totalQuestions = session.answers.length;
  const wrongAnswers = totalQuestions - correctAnswers;
  const today = dayOf(new Date());

  let stats = await UserStatistics.findOne({ user: userId });

  if (!stats) {
    stats = await UserStatistics.create({
      user: userId,
      totalQuizzes: 0,
      totalQuestions: 0,
      correctAnswers: 0,
      wrongAnswers: 0,
      accuracy: 0,
      currentStreak: 0,
      longestStreak: 0,
      topicPerformance: [],
      lastQuizDate: null,
    });
  }

  const isFirstEver = stats.totalQuestions === 0 && stats.totalQuizzes === 0;

  let newStreak = 0;
  if (isFirstEver) {
    newStreak = 1;
  } else if (!stats.lastQuizDate || !isSameDay(stats.lastQuizDate, today)) {
    if (stats.lastQuizDate && isConsecutiveDay(stats.lastQuizDate, today)) {
      newStreak = stats.currentStreak + 1;
    } else if (stats.lastQuizDate === yesterdayKey(today)) {
      newStreak = stats.currentStreak + 1;
    } else {
      newStreak = 1;
    }
  } else {
    newStreak = stats.currentStreak;
  }

  stats.totalQuizzes += 1;
  stats.totalQuestions += totalQuestions;
  stats.correctAnswers += correctAnswers;
  stats.wrongAnswers += wrongAnswers;
  stats.accuracy =
    stats.totalQuestions > 0
      ? Math.round((stats.correctAnswers / stats.totalQuestions) * 100 * 100) / 100
      : 0;
  stats.currentStreak = newStreak;
  stats.longestStreak = Math.max(stats.longestStreak, newStreak);
  stats.lastQuizDate = today;
  stats.lastActiveAt = new Date();

  await updateTopicPerformance(stats, session);

  await stats.save();
}

async function updateTopicPerformance(stats: any, session: any): Promise<void> {
  const questionIds = session.answers.map((a: any) => a.question);
  const populated = await Question.find({ _id: { $in: questionIds } }).lean();

  const topicMap = new Map<string, { total: number; correct: number }>();
  for (const q of populated) {
    const key = q.subtopic || q.topic;
    const entry = topicMap.get(key) ?? { total: 0, correct: 0 };
    entry.total += 1;
    const answer = session.answers.find(
      (a: any) => String(a.question) === String(q._id)
    );
    if (answer?.isCorrect) entry.correct += 1;
    topicMap.set(key, entry);
  }

  const overallMap = new Map<string, { total: number; correct: number }>();
  for (const t of stats.topicPerformance ?? []) {
    overallMap.set(t.topic, { total: t.total, correct: t.correct });
  }

  for (const [topic, entry] of topicMap) {
    const existing = overallMap.get(topic) ?? { total: 0, correct: 0 };
    existing.total += entry.total;
    existing.correct += entry.correct;
    overallMap.set(topic, existing);
  }

  stats.topicPerformance = [...overallMap.entries()].map(([topic, e]) => ({
    topic,
    total: e.total,
    correct: e.correct,
  }));
}
