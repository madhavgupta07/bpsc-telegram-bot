import type { Message, CallbackQuery, Update } from './telegram.types';
import { telegramService as tg } from './telegram.service';
import { User } from '../models/User';
import { DailyQuiz } from '../models/DailyQuiz';
import { Question } from '../models/Question';
import { QuizSession } from '../models/QuizSession';
import { SessionStatus } from '../config/constants';
import { UserStatistics } from '../models/UserStatistics';
import { logger } from '../utils/logger';
import { getDateKey } from '../utils/date';
import {
  startSession,
  submitAnswer,
} from './session.service';
import { findActiveQuizForDate } from './quiz.service';

const START_MESSAGE =
  'Welcome to Bihar STET Computer Science Quiz!\n\n' +
  'You will receive a daily Computer Science quiz every day at 8:00 PM IST.\n\n' +
  'Use /quiz to start today\'s quiz manually.\n' +
  'Use /score to see your performance.\n' +
  'Use /streak to see your current streak.\n' +
  'Use /help to see available commands.';

const HELP_MESSAGE =
  'Available commands:\n\n' +
  '/start - Register and see welcome message\n' +
  '/quiz - Start today\'s quiz manually\n' +
  '/score - See your performance stats\n' +
  '/streak - See your current daily streak\n' +
  '/help - Show this help message\n\n' +
  'You will also automatically receive a daily quiz every day at 8:00 PM IST.';

type MessageText = Message & { text: string };

const GROUP_QUESTION_TIMEOUT_MS = 10_000;

type GroupMemberScore = {
  name: string;
  correct: number;
  answered: number;
};

type GroupGame = {
  quizId: string;
  questions: any[];
  currentIndex: number;
  scores: Map<number, GroupMemberScore>;
  timer: NodeJS.Timeout | null;
};

export class TelegramBotHandler {
  private groupGames = new Map<number, GroupGame>();

  async handleUpdate(update: Update): Promise<void> {
    if (update.message) {
      await this.handleMessage(update.message);
    } else if (update.callback_query) {
      await this.handleCallbackQuery(update.callback_query);
    }
  }

  private async handleMessage(message: Message): Promise<void> {
    if (!('text' in message)) return;
    const msg = message as MessageText;
    const chatId = msg.chat.id;
    const text = msg.text?.trim() ?? '';
    const chatType = msg.chat.type;

    const isGroup = chatType === 'group' || chatType === 'supergroup';

    if (isGroup) {
      await this.handleGroupMessage(msg);
      return;
    }

    await this.registerUserIfNeeded(msg);

    if (text === '/start') {
      await this.sendStart(chatId);
    } else if (text === '/help') {
      await this.sendHelp(chatId);
    } else if (text === '/quiz') {
      await this.sendQuiz(chatId, msg.from?.id);
    } else if (text === '/score') {
      await this.sendScore(chatId, msg.from?.id);
    } else if (text === '/streak') {
      await this.sendStreak(chatId, msg.from?.id);
    } else if (text.startsWith('/')) {
      await this.sendUnknown(chatId);
    }
  }

  private async handleCallbackQuery(callback: CallbackQuery): Promise<void> {
    const data = callback.data;
    if (!data) return;

    const fromId = callback.from?.id;
    const chatId = callback.message?.chat?.id ?? fromId;
    if (chatId === undefined) return;

    if (data.startsWith('answer:')) {
      await this.handleAnswer(callback, chatId, fromId, data);
    } else if (data === 'finish') {
      await this.handleFinish(callback, chatId, fromId);
    } else if (data.startsWith('group_answer:')) {
      await this.handleGroupAnswer(callback, chatId, fromId, data);
    }
  }

  private async handleGroupMessage(msg: MessageText): Promise<void> {
    const chatId = msg.chat.id;
    const text = msg.text?.trim() ?? '';

    if (!text.startsWith('/quiz')) return;

    const fromId = msg.from?.id;
    if (!fromId) return;

    const isAdmin = await this.isGroupAdmin(chatId, fromId);
    if (!isAdmin) {
      await tg.sendMessage(chatId, 'Only group admins can start a quiz in this group.');
      return;
    }

    const args = text.replace('/quiz', '').trim();
    let quiz: any;
    if (/^\d{4}-\d{2}-\d{2}$/.test(args)) {
      quiz = await DailyQuiz.findOne({ date: args, status: 'PUBLISHED' })
        .populate('questions')
        .lean();
      if (!quiz) {
        await tg.sendMessage(chatId, `No published quiz found for ${args}.`);
        return;
      }
    } else {
      const today = getDateKey();
      quiz = await findActiveQuizForDate(today);
      if (!quiz) {
        await tg.sendMessage(
          chatId,
          'No quiz is published for today. Admins can run /quiz YYYY-MM-DD to start a specific published quiz.'
        );
        return;
      }
    }

    if (!quiz.questions || quiz.questions.length === 0) {
      await tg.sendMessage(chatId, 'This quiz has no questions to play.');
      return;
    }

    await this.startGroupQuiz(chatId, quiz);
  }

  private async isGroupAdmin(chatId: number, userId: number): Promise<boolean> {
    try {
      const member = await tg.getChatMember(chatId, userId);
      const status = member?.result?.status;
      return status === 'administrator' || status === 'creator';
    } catch {
      return false;
    }
  }

  private async startGroupQuiz(chatId: number, quiz: any): Promise<void> {
    const existing = this.groupGames.get(chatId);
    if (existing?.timer) clearTimeout(existing.timer);
    if (existing) this.groupGames.delete(chatId);

    const game: GroupGame = {
      quizId: String(quiz._id),
      questions: (quiz.questions ?? []) as any[],
      currentIndex: 0,
      scores: new Map(),
      timer: null,
    };

    this.groupGames.set(chatId, game);
    await tg.sendMessage(chatId, `🎮 Group Quiz starting! ${game.questions.length} questions, 10s each.`);

    await this.postGroupQuestion(chatId, game);
  }

  private async postGroupQuestion(chatId: number, game: GroupGame): Promise<void> {
    const index = game.currentIndex;
    const questions = game.questions;

    if (index >= questions.length) {
      await this.postGroupScoreboard(chatId, game);
      return;
    }

    const questionDoc = questions[index];
    const question =
      questionDoc._id && questionDoc.question
        ? questionDoc
        : await Question.findById(String(questionDoc._id || questionDoc)).lean();

    if (!question || !question.question) {
      game.currentIndex += 1;
      await this.postGroupQuestion(chatId, game);
      return;
    }

    const optionRows = question.options.map((opt: string, i: number) => [
      {
        text: opt,
        callback_data: `group_answer:${game.quizId}:${index}:${i}`,
      },
    ]);

    const text =
      `📚 Bihar STET Quiz — Question ${index + 1}/${questions.length}\n` +
      `⏱ You have ${GROUP_QUESTION_TIMEOUT_MS / 1000}s. Tap your answer once!\n\n` +
      `${question.question}`;

    await tg.sendMessage(chatId, text, {
      replyMarkup: { inline_keyboard: optionRows },
    });

    game.timer = setTimeout(() => {
      game.currentIndex += 1;
      this.postGroupQuestion(chatId, game).catch(() => undefined);
    }, GROUP_QUESTION_TIMEOUT_MS);
  }

  private async handleGroupAnswer(
    callback: CallbackQuery,
    chatId: number,
    fromId: number | undefined,
    data: string
  ): Promise<void> {
    const [, , qIndexStr, optIndexStr] = data.split(':');
    const qIndex = parseInt(qIndexStr, 10);
    const optIndex = parseInt(optIndexStr, 10);

    if (fromId === undefined) return;

    const game = this.groupGames.get(chatId);
    if (!game || qIndex !== game.currentIndex) {
      await tg.answerCallbackQuery(callback.id!, {
        text: 'Too late or this question has closed.',
        showAlert: true,
      });
      return;
    }

    const questionDoc = game.questions[qIndex];
    const question =
      questionDoc._id && questionDoc.question
        ? questionDoc
        : await Question.findById(String(questionDoc._id || questionDoc)).lean();
    if (!question) return;

    const selectedOption = question.options?.[optIndex];
    if (selectedOption === undefined) return;

    const existing = game.scores.get(fromId);
    if (existing && existing.answered > qIndex) {
      await tg.answerCallbackQuery(callback.id!, {
        text: 'You already answered this question.',
        showAlert: true,
      });
      return;
    }

    const isCorrect = selectedOption === question.correctAnswer;

    await tg.answerCallbackQuery(callback.id!, {
      text: isCorrect ? '✅ Correct!' : '❌ Incorrect',
    });

    const member = callback.from;
    const memberScore = game.scores.get(fromId) ?? {
      name: member.first_name ?? `User ${fromId}`,
      correct: 0,
      answered: 0,
    };

    memberScore.answered += 1;
    if (isCorrect) memberScore.correct += 1;
    game.scores.set(fromId, memberScore);
  }

  private async postGroupScoreboard(chatId: number, game: GroupGame): Promise<void> {
    if (game.timer) clearTimeout(game.timer);
    game.timer = null;

    const sorted = [...game.scores.entries()].sort((a, b) => b[1].correct - a[1].correct);

    let lines: string;
    if (sorted.length === 0) {
      lines = '🎯 No one participated this round.';
    } else {
      lines = sorted
        .map(
          (entry, i) =>
            `${i + 1}. ${entry[1].name} — ${entry[1].correct} correct`
        )
        .join('\n');
    }

    await tg.sendMessage(
      chatId,
      `🏁 Quiz finished!\n\n${lines}\n\n🎯 Scoreboard only — streaks are tracked in private quizzes.`
    );

    this.groupGames.delete(chatId);
  }

  private async registerUserIfNeeded(msg: MessageText): Promise<void> {
    const from = msg.from;
    if (!from) return;

    const existing = await User.findOne({ telegramId: from.id });
    if (existing) {
      if (!existing.isActive) {
        existing.isActive = true;
        existing.blockedAt = null;
        await existing.save();
      }
      return;
    }

    await User.create({
      telegramId: from.id,
      telegramUsername: from.username ?? null,
      firstName: from.first_name ?? null,
      lastName: from.last_name ?? null,
      isActive: true,
      isSubscribed: true,
    });

    logger.info('New Telegram user registered', {
      telegramId: from.id,
      username: from.username,
    });
  }

  private async sendStart(chatId: number): Promise<void> {
    await tg.sendMessage(chatId, START_MESSAGE);
  }

  private async sendHelp(chatId: number): Promise<void> {
    await tg.sendMessage(chatId, HELP_MESSAGE);
  }

  private async sendUnknown(chatId: number): Promise<void> {
    await tg.sendMessage(chatId, 'Unknown command. Use /help to see available commands.');
  }

  private async sendQuiz(chatId: number, telegramId?: number, quiz?: any): Promise<void> {
    if (!telegramId) return;

    const user = await User.findOne({ telegramId });
    if (!user) {
      await tg.sendMessage(chatId, 'Please send /start first to register.');
      return;
    }

    let activeQuiz = quiz;
    if (!activeQuiz) {
      const today = getDateKey();
      activeQuiz = await findActiveQuizForDate(today);
    }

    if (!activeQuiz) {
      await tg.sendMessage(
        chatId,
        'No quiz is available right now. Please check back later or start one from the admin dashboard.'
      );
      return;
    }

    const session = await startSession(String(user._id), String(activeQuiz._id));

    if (session.status === SessionStatus.COMPLETED) {
      await tg.sendMessage(chatId, 'You have already completed this quiz. See you tomorrow!');
      return;
    }

    const questions = (activeQuiz.questions ?? []) as any[];
    const currentIndex = session.currentQuestion ?? 0;

    if (session.status === SessionStatus.NOT_STARTED || currentIndex === 0) {
      const started = await startSession(String(user._id), String(activeQuiz._id));
      await this.sendQuestion(chatId, String(activeQuiz._id), started);
    } else if (currentIndex >= questions.length) {
      await this.showSummary(chatId, session);
    } else {
      await this.sendQuestion(chatId, String(activeQuiz._id), session);
    }
  }

  private async sendQuestion(chatId: number, quizId: string, session: any): Promise<void> {
    const quiz = await DailyQuiz.findById(quizId).populate('questions').lean();
    if (!quiz) return;

    const questions = (quiz.questions ?? []) as any[];
    const index = session.currentQuestion ?? 0;

    if (index >= questions.length) {
      await this.showSummary(chatId, session);
      return;
    }

    const questionDoc = questions[index];
    const questionId = String(questionDoc._id || questionDoc);
    const question =
      questionDoc._id && questionDoc.question
        ? questionDoc
        : await Question.findById(questionId).lean();

    if (!question || !question.question) {
      await tg.sendMessage(chatId, 'There was a problem loading this question.');
      return;
    }

    const total = session.totalQuestions || questions.length;
    const optionRows = question.options.map((opt: string, i: number) => [
      {
        text: opt,
        callback_data: `answer:${quizId}:${index}:${i}`,
      },
    ]);

    const markup = {
      inline_keyboard: optionRows,
    };

    const text =
      `📚 Bihar STET Daily Quiz\n\n` +
      `Question ${index + 1}/${total}\n\n` +
      `${question.question}`;

    await tg.sendMessage(chatId, text, { replyMarkup: markup });
  }

  private async handleAnswer(
    callback: CallbackQuery,
    chatId: number,
    fromId: number | undefined,
    data: string
  ): Promise<void> {
    const [, quizId, qIndexStr, optIndexStr] = data.split(':');
    const qIndex = parseInt(qIndexStr, 10);
    const optIndex = parseInt(optIndexStr, 10);

    if (!fromId) return;
    await tg.answerCallbackQuery(callback.id!);

    const user = await User.findOne({ telegramId: fromId });
    if (!user) {
      await tg.sendMessage(chatId, 'Please send /start first to register.');
      return;
    }

    const quiz = await DailyQuiz.findById(quizId).populate('questions').lean();
    if (!quiz) {
      await tg.sendMessage(chatId, 'This quiz is no longer available.');
      return;
    }

    const questions = (quiz.questions ?? []) as any[];
    if (qIndex < 0 || qIndex >= questions.length) return;

    const questionDoc = questions[qIndex];
    const questionId = String(questionDoc._id || questionDoc);
    const question =
      questionDoc._id && questionDoc.question
        ? questionDoc
        : await Question.findById(questionId).lean();
    if (!question) return;

    const selectedOption = question.options?.[optIndex];
    if (selectedOption === undefined) return;

    const result = await submitAnswer(String(user._id), String(quiz._id), questionId, selectedOption);

    const session =
      result.session && result.session._id
        ? result.session
        : await QuizSession.findOne({ user: user._id, dailyQuiz: quiz._id });

    await this.getAnswerFeedback(chatId, session, quiz, qIndex);
  }

  private async getAnswerFeedback(
    chatId: number,
    session: any,
    quiz: any,
    qIndex: number
  ): Promise<void> {
    const questions = (quiz.questions ?? []) as any[];
    const questionDoc = questions[qIndex];
    const questionId = String(questionDoc._id || questionDoc);
    const question =
      questionDoc._id && questionDoc.question
        ? questionDoc
        : await Question.findById(questionId).lean();
    if (!question) return;

    const answer = (session.answers ?? []).find(
      (a: any) => String(a.question) === String(questionId)
    );

    if (!answer) return;

    let feedback: string;
    if (answer.isCorrect) {
      feedback =
        `✅ Correct!\n\n` +
        `${answer.correctAnswer}.\n\n` +
        `${question.explanation ?? ''}\n\n` +
        `Score: ${session.score}/${session.totalQuestions || questions.length}`;
    } else {
      feedback =
        `❌ Incorrect\n\n` +
        `Correct answer: ${answer.correctAnswer}\n\n` +
        `${question.explanation ?? ''}\n\n` +
        `Score: ${session.score}/${session.totalQuestions || questions.length}`;
    }

    await tg.sendMessage(chatId, feedback);

    const nextIndex = qIndex + 1;
    if (nextIndex < questions.length) {
      await this.sendQuestion(chatId, String(quiz._id), { ...session, currentQuestion: nextIndex });
    } else {
      await this.showSummary(chatId, session);
    }
  }

  private async handleFinish(
    callback: CallbackQuery,
    chatId: number,
    fromId: number | undefined
  ): Promise<void> {
    await tg.answerCallbackQuery(callback.id!);

    if (!fromId) return;
    const user = await User.findOne({ telegramId: fromId });
    if (!user) {
      await tg.sendMessage(chatId, 'Please send /start first.');
      return;
    }

    const session = await QuizSession.findOne({ user: user._id, status: SessionStatus.IN_PROGRESS })
      .sort({ startedAt: -1 });
    if (!session) {
      await tg.sendMessage(chatId, 'No active quiz in progress.');
      return;
    }

    const { completeSession } = await import('./session.service');
    const completed = await completeSession(String(user._id), String(session.dailyQuiz));

    await this.showSummary(chatId, completed);
  }

  private async showSummary(chatId: number, session: any): Promise<void> {
    const correct = session.answers.filter((a: any) => a.isCorrect).length;
    const total = session.totalQuestions || session.answers.length;
    const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;

    await this.updateStreakForSummary(session);

    const stats = await UserStatistics.findOne({ user: session.user });

    let summary =
      `🎯 Quiz Completed!\n\n` +
      `Score: ${correct}/${total}\n` +
      `Accuracy: ${accuracy}%\n`;

    summary += `\n🔥 Current Streak: ${stats?.currentStreak ?? 0} days`;

    await tg.sendMessage(chatId, summary);
  }

  private async updateStreakForSummary(session: any): Promise<void> {
    await import('./session.service').then(async ({ completeSession }) => {
      if (session.status !== SessionStatus.COMPLETED) {
        await completeSession(String(session.user), String(session.dailyQuiz));
      }
    });
  }

  private async sendScore(chatId: number, telegramId?: number): Promise<void> {
    if (!telegramId) return;
    const user = await User.findOne({ telegramId });
    if (!user) {
      await tg.sendMessage(chatId, 'Please send /start first to register.');
      return;
    }

    const stats = await UserStatistics.findOne({ user: user._id });

    if (!stats || stats.totalQuestions === 0) {
      await tg.sendMessage(chatId, 'You haven\'t completed any quizzes yet. Use /quiz to start!');
      return;
    }

    const text =
      `📊 Your Performance\n\n` +
      `Total Quizzes: ${stats.totalQuizzes}\n` +
      `Total Questions: ${stats.totalQuestions}\n` +
      `Correct Answers: ${stats.correctAnswers}\n` +
      `Wrong Answers: ${stats.wrongAnswers}\n` +
      `Accuracy: ${stats.accuracy}%\n` +
      `Average Score per Quiz: ${(stats.correctAnswers / (stats.totalQuizzes || 1)).toFixed(2)}\n` +
      `Best Streak: ${stats.longestStreak} days`;

    await tg.sendMessage(chatId, text);
  }

  private async sendStreak(chatId: number, telegramId?: number): Promise<void> {
    if (!telegramId) return;
    const user = await User.findOne({ telegramId });
    if (!user) {
      await tg.sendMessage(chatId, 'Please send /start first to register.');
      return;
    }

    const stats = await UserStatistics.findOne({ user: user._id });
    const streak = stats?.currentStreak ?? 0;
    const longest = stats?.longestStreak ?? 0;

    const flame = streak > 0 ? '🔥' : '';
    const text =
      `${flame} Current Streak: ${streak} day${streak === 1 ? '' : 's'}\n` +
      `Longest Streak: ${longest} day${longest === 1 ? '' : 's'}\n\n` +
      (streak > 0
        ? 'Keep it up! Complete today\'s quiz to extend your streak.'
        : 'Complete today\'s quiz to start a streak!');

    await tg.sendMessage(chatId, text);
  }

  async deliverQuiz(telegramId: number, quiz?: any): Promise<void> {
    let targetQuiz = quiz;
    if (!targetQuiz) {
      const today = getDateKey();
      targetQuiz = await findActiveQuizForDate(today);
    }
    if (!targetQuiz) return;

    await this.sendQuiz(telegramId, telegramId, targetQuiz);
  }
}

export const telegramBotHandler = new TelegramBotHandler();
export const startTelegramBot = () => {
  // Bot logic driven by webhook; nothing to start in serverless mode.
};
