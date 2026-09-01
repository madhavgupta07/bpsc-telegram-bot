import { describe, it, expect, beforeEach } from 'vitest';
import mongoose from 'mongoose';

import { Question } from '../models/Question';
import { DailyQuiz } from '../models/DailyQuiz';
import { User } from '../models/User';
import { UserStatistics } from '../models/UserStatistics';
import { QuizSession } from '../models/QuizSession';
import { SessionStatus } from '../config/constants';
import {
  selectQuestionsForQuiz,
  createDailyQuiz,
  findActiveQuizForDate,
} from './quiz.service';
import {
  startSession,
  submitAnswer,
  updateUserStatistics,
} from './session.service';

function makeQuestion(topic: string, difficulty: string, i: number) {
  return {
    question: `Q ${topic} ${difficulty} ${i}: Unique question text that is long enough`,
    options: ['Option A', 'Option B', 'Option C', 'Option D'],
    correctAnswer: 'Option A',
    explanation: 'This is a sufficiently detailed explanation for the correct answer.',
    topic,
    subtopic: topic,
    difficulty,
    isActive: true,
    isVerified: true,
  };
}

describe('quiz selection', () => {
  beforeEach(async () => {
    await Question.deleteMany({});
    await DailyQuiz.deleteMany({});
  });

  it('selects questions respecting topic distribution', async () => {
    for (let i = 0; i < 6; i++) {
      await Question.create(makeQuestion('Operating Systems', 'easy', i));
      await Question.create(makeQuestion('Data Structures', 'easy', i));
      await Question.create(makeQuestion('Algorithms', 'easy', i));
    }

    const selected = await selectQuestionsForQuiz(
      { 'Operating Systems': 2, 'Data Structures': 2, 'Algorithms': 1 },
      { totalQuestions: 5 }
    );

    expect(selected).toHaveLength(5);
    const os = selected.filter((q) => q.topic === 'Operating Systems').length;
    const ds = selected.filter((q) => q.topic === 'Data Structures').length;
    const alg = selected.filter((q) => q.topic === 'Algorithms').length;
    expect(os).toBe(2);
    expect(ds).toBe(2);
    expect(alg).toBe(1);
  });

  it('does not select duplicate questions', async () => {
    for (let i = 0; i < 6; i++) {
      await Question.create(makeQuestion('Operating Systems', 'easy', i));
    }
    const selected = await selectQuestionsForQuiz(
      { 'Operating Systems': 10 },
      { totalQuestions: 5 }
    );
    const ids = selected.map((q) => String(q._id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('does not select deactivated questions', async () => {
    await Question.create(makeQuestion('Operating Systems', 'easy', 0));
    await Question.create({ ...makeQuestion('Operating Systems', 'easy', 1), isActive: false });

    const selected = await selectQuestionsForQuiz(
      { 'Operating Systems': 5 },
      { totalQuestions: 2 }
    );
    for (const q of selected) {
      expect(q.isActive).toBe(true);
    }
  });

  it('rejects selection when no topics configured', async () => {
    await expect(
      selectQuestionsForQuiz({}, { totalQuestions: 5 })
    ).rejects.toThrow();
  });

  it('distributes difficulty approximately per the distribution', async () => {
    for (let i = 0; i < 8; i++) {
      await Question.create(makeQuestion('Operating Systems', 'easy', i));
      await Question.create(makeQuestion('Operating Systems', 'medium', i));
      await Question.create(makeQuestion('Operating Systems', 'hard', i));
    }
    const selected = await selectQuestionsForQuiz(
      { 'Operating Systems': 10 },
      {
        totalQuestions: 10,
        difficultyDistribution: { easy: 0.3, medium: 0.5, hard: 0.2 },
      }
    );
    expect(selected).toHaveLength(10);
  });
});

describe('daily quiz creation', () => {
  beforeEach(async () => {
    await Question.deleteMany({});
    await DailyQuiz.deleteMany({});
  });

  it('creates a quiz for a date', async () => {
    const qs = [
      await Question.create(makeQuestion('OS', 'easy', 0)),
      await Question.create(makeQuestion('OS', 'medium', 1)),
    ];
    const { quiz, created } = await createDailyQuiz('2026-09-02', qs as any, {
      OS: 2,
    });
    expect(created).toBe(true);
    expect(quiz.date).toBe('2026-09-02');
    expect(quiz.totalQuestions).toBe(2);

    const found = await findActiveQuizForDate('2026-09-02');
    expect(found).toBeTruthy();
  });

  it('prevents duplicate daily quizzes for the same date', async () => {
    const q1 = await Question.create(makeQuestion('OS', 'easy', 0));
    const q2 = await Question.create(makeQuestion('OS', 'easy', 1));
    await createDailyQuiz('2026-09-03', [q1, q2] as any, { OS: 2 });
    const { created } = await createDailyQuiz('2026-09-03', [q1, q2] as any, {
      OS: 2,
    });
    expect(created).toBe(false);

    const count = await DailyQuiz.countDocuments({ date: '2026-09-03' });
    expect(count).toBe(1);
  });
});

describe('quiz session & scoring', () => {
  let user: any;
  let quiz: any;
  let questions: any[];

  beforeEach(async () => {
    await Question.deleteMany({});
    await DailyQuiz.deleteMany({});
    await User.deleteMany({});
    await UserStatistics.deleteMany({});
    await QuizSession.deleteMany({});

    user = await User.create({ telegramId: 123456, isActive: true, isSubscribed: true });
    questions = [
      await Question.create(makeQuestion('OS', 'easy', 0)),
      await Question.create(makeQuestion('OS', 'medium', 1)),
      await Question.create(makeQuestion('OS', 'hard', 2)),
    ];
    const { quiz: createdQuiz } = await createDailyQuiz('2026-09-05', questions as any, {
      OS: 3,
    });
    quiz = createdQuiz;
  });

  it('starts a session and transitions to IN_PROGRESS', async () => {
    const session = await startSession(String(user._id), String(quiz._id));
    expect(session.status).toBe(SessionStatus.IN_PROGRESS);
  });

  it('calculates score correctly', async () => {
    const s = await startSession(String(user._id), String(quiz._id));

    await submitAnswer(String(user._id), String(quiz._id), String(questions[0]._id), 'Option A');
    await submitAnswer(String(user._id), String(quiz._id), String(questions[1]._id), 'Wrong');
    await submitAnswer(String(user._id), String(quiz._id), String(questions[2]._id), 'Option A');

    const saved = await QuizSession.findById(s._id);
    expect(saved.score).toBe(2);
  });

  it('prevents duplicate submissions from double counting score', async () => {
    await startSession(String(user._id), String(quiz._id));
    const r1 = await submitAnswer(String(user._id), String(quiz._id), String(questions[0]._id), 'Option A');
    const r2 = await submitAnswer(String(user._id), String(quiz._id), String(questions[0]._id), 'Option A');

    expect(r1.isCorrect).toBe(true);
    expect(r2.alreadyAnswered).toBe(true);
    expect(r2.isCorrect).toBe(true);

    const saved = await QuizSession.findById(r1.session._id);
    expect(saved.answers).toHaveLength(1);
    expect(saved.score).toBe(1);
  });

  it('marks session completed after all questions', async () => {
    await startSession(String(user._id), String(quiz._id));
    for (const q of questions) {
      await submitAnswer(String(user._id), String(quiz._id), String(q._id), 'Option A');
    }
    const saved = await QuizSession.findOne({ user: user._id, dailyQuiz: quiz._id });
    expect(saved.status).toBe(SessionStatus.COMPLETED);
    expect(saved.score).toBe(3);
  });
});

describe('streak system', () => {
  it('awards streak 1 on first quiz', async () => {
    const userId = new mongoose.Types.ObjectId();
    await UserStatistics.create({
      user: userId,
      totalQuizzes: 0,
      totalQuestions: 0,
      correctAnswers: 0,
      wrongAnswers: 0,
      accuracy: 0,
      currentStreak: 0,
      longestStreak: 0,
      lastQuizDate: null,
    });
    await updateUserStatistics(String(userId), {
      answers: [{ isCorrect: true }, { isCorrect: false }],
      status: 'COMPLETED',
    });
    const updated = await UserStatistics.findOne({ user: userId });
    expect(updated.currentStreak).toBe(1);
    expect(updated.longestStreak).toBe(1);
  });

  it('same-day attempts do not double-count the streak', async () => {
    const userId = new mongoose.Types.ObjectId();
    const today = new Date();
    const todayKey = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
      .format(today)
      .replace(/\//g, '-');

    await UserStatistics.create({
      user: userId,
      totalQuizzes: 1,
      totalQuestions: 3,
      correctAnswers: 2,
      wrongAnswers: 1,
      accuracy: 66,
      currentStreak: 5,
      longestStreak: 5,
      lastQuizDate: todayKey,
    });

    await updateUserStatistics(String(userId), {
      answers: [{ isCorrect: true }],
      status: 'COMPLETED',
    });

    const updated = await UserStatistics.findOne({ user: userId });
    expect(updated.currentStreak).toBe(5);
  });

  it('resets streak when a day is missed', async () => {
    const userId = new mongoose.Types.ObjectId();
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

    await UserStatistics.create({
      user: userId,
      totalQuizzes: 1,
      totalQuestions: 3,
      correctAnswers: 2,
      wrongAnswers: 1,
      accuracy: 66,
      currentStreak: 5,
      longestStreak: 5,
      lastQuizDate: new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      })
        .format(twoDaysAgo)
        .replace(/\//g, '-'),
    });

    await updateUserStatistics(String(userId), {
      answers: [{ isCorrect: true }],
      status: 'COMPLETED',
    });

    const updated = await UserStatistics.findOne({ user: userId });
    expect(updated.currentStreak).toBe(1);
  });
});
