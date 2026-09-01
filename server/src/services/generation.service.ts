import type { QuestionType } from '../models/Question';
import { DailyQuiz } from '../models/DailyQuiz';
import { Question } from '../models/Question';
import { Topic } from '../models/Topic';
import { logger } from '../utils/logger';
import { env } from '../config/env';
import { QuizStatus, type DifficultyDistribution } from '../config/constants';
import { generateQuestions, isOpenRouterConfigured } from './openrouter.service';
import { validateNewQuestions, saveValidatedQuestions } from './questionValidation.service';
import { selectQuestionsForQuiz, createDailyQuiz, getRecentQuestionIds } from './quiz.service';

export interface GenerateQuizParams {
  totalQuestions?: number;
  topicDistribution?: Record<string, number>;
  difficultyDistribution?: Record<string, number>;
  regenerate?: boolean;
}

function normalizeDifficulty(
  raw?: Record<string, number>
): DifficultyDistribution {
  if (!raw) return { easy: 0.3, medium: 0.5, hard: 0.2 };
  const easy = raw.easy ?? 0.3;
  const medium = raw.medium ?? 0.5;
  const hard = raw.hard ?? 0.2;
  const sum = easy + medium + hard;
  if (sum <= 0) return { easy: 0.3, medium: 0.5, hard: 0.2 };
  return {
    easy: easy / sum,
    medium: medium / sum,
    hard: hard / sum,
  };
}

export async function generateQuizForDate(
  dateKey: string,
  params: GenerateQuizParams = {}
): Promise<{ quiz: any; created: boolean }> {
  const total = params.totalQuestions ?? 10;
  const topicDistribution = params.topicDistribution ?? {};
  const regenerate = params.regenerate ?? false;

  if (regenerate) {
    await DailyQuiz.deleteOne({ date: dateKey });
  }

  const topicNames = Object.keys(topicDistribution);
  let topicContext = '';
  if (topicNames.length > 0) {
    const topics = await Topic.find({ name: { $in: topicNames } }).lean();
    topicContext = topics.map((t) => t.name).join(', ');
  }

  if (!isOpenRouterConfigured()) {
    logger.warn(
      'OpenRouter not configured. Falling back to existing validated questions from the database.'
    );
    return buildQuizFromDatabase(dateKey, params);
  }

  try {
    const recentIds = await getRecentQuestionIds(14);

    const avoidSubtopics = await getRecentSubtopics();

    const aiQuestions = await generateQuestions({
      topicContext: topicContext || 'Bihar STET Computer Science syllabus',
      difficultyDistribution: params.difficultyDistribution,
      count: Math.ceil(total * 1.5),
      avoidSubtopic: avoidSubtopics,
    });

    const { valid } = await validateNewQuestions(aiQuestions);

    if (valid.length >= total) {
      const savedIds = await saveValidatedQuestions(
        valid.slice(0, Math.ceil(total * 1.5)),
        'AI',
        env.openRouterModel
      );

      if (savedIds.length > 0) {
        const savedQuestions = await Question.find({ _id: { $in: savedIds } }).lean();
        return buildQuiz(dateKey, savedQuestions, params, recentIds);
      }

      logger.info('AI generated questions, but none were new. Falling back to database selection.');
      return buildQuizFromDatabase(dateKey, params, recentIds);
    }

    logger.warn(
      `AI generated insufficient valid questions (${valid.length}/${total}). Falling back to database.`
    );
    if (valid.length > 0) {
      await saveValidatedQuestions(valid, 'AI', env.openRouterModel);
    }
    return buildQuizFromDatabase(dateKey, params, recentIds);
  } catch (error) {
    logger.error('AI quiz generation failed, falling back to database questions', error);
    try {
      return await buildQuizFromDatabase(dateKey, params);
    } catch (fallbackError) {
      logger.error('Database fallback quiz generation failed', fallbackError);
      const quiz = await markQuizFailed(dateKey, (error as Error).message);
      return { quiz, created: true };
    }
  }
}

async function buildQuiz(
  dateKey: string,
  _pool: QuestionType[],
  params: GenerateQuizParams,
  excludeIds: string[]
): Promise<{ quiz: any; created: boolean }> {
  const topicDistribution = params.topicDistribution ?? {};
  const selected = await selectQuestionsForQuiz(
    topicDistribution,
    {
      totalQuestions: params.totalQuestions,
      difficultyDistribution: normalizeDifficulty(params.difficultyDistribution),
    },
    excludeIds,
    []
  );

  const result = await createDailyQuiz(dateKey, selected, topicDistribution);
  await markQuestionsUsedInQuiz(selected);
  return result;
}

async function buildQuizFromDatabase(
  dateKey: string,
  params: GenerateQuizParams,
  recentIds: string[] = []
): Promise<{ quiz: any; created: boolean }> {
  const topicDistribution = params.topicDistribution ?? {};
  const selected = await selectQuestionsForQuiz(
    topicDistribution,
    {
      totalQuestions: params.totalQuestions,
      difficultyDistribution: normalizeDifficulty(params.difficultyDistribution),
    },
    recentIds,
    []
  );

  const result = await createDailyQuiz(dateKey, selected, topicDistribution);
  await markQuestionsUsedInQuiz(selected);
  return result;
}

async function markQuestionsUsedInQuiz(questions: QuestionType[]): Promise<void> {
  const questionIds = questions.map((q) => String(q._id));
  await Question.updateMany(
    { _id: { $in: questionIds } },
    { $inc: { usedCount: 1 }, $set: { lastUsedAt: new Date() } }
  );
}

async function getRecentSubtopics(limit = 10): Promise<string[]> {
  const recent = await Question.find({ lastUsedAt: { $ne: null } })
    .sort({ lastUsedAt: -1 })
    .limit(limit)
    .select('subtopic')
    .lean();
  return recent.map((q) => q.subtopic).filter(Boolean) as string[];
}

async function markQuizFailed(dateKey: string, errorMessage: string): Promise<any> {
  const quiz = await DailyQuiz.create({
    date: dateKey,
    questions: [],
    topicDistribution: {},
    totalQuestions: 0,
    status: QuizStatus.FAILED,
    validationStatus: 'FAILED',
    generationError: errorMessage,
  });
  return quiz;
}
