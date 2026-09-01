export type Difficulty = 'easy' | 'medium' | 'hard';

export const DIFFICULTIES = ['easy', 'medium', 'hard'] as const;
export type DifficultyArray = typeof DIFFICULTIES;

export interface DifficultyDistribution {
  easy: number;
  medium: number;
  hard: number;
}

export const DEFAULT_DIFFICULTY_DISTRIBUTION: DifficultyDistribution = {
  easy: 0.3,
  medium: 0.5,
  hard: 0.2,
};

export interface QuizTopicDistribution {
  [topic: string]: number;
}

export const DEFAULT_TOPIC_DISTRIBUTION: QuizTopicDistribution = {
  'Operating Systems': 2,
  'Data Structures': 2,
  'Algorithms': 2,
  'Digital Logic': 1,
  'DBMS': 1,
  'Computer Networks': 1,
  'COA': 1,
};

export const DEFAULT_QUESTIONS_PER_QUIZ = 10;

export const QuizStatus = {
  DRAFT: 'DRAFT',
  PUBLISHED: 'PUBLISHED',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
} as const;

export type QuizStatusType = (typeof QuizStatus)[keyof typeof QuizStatus];

export const SessionStatus = {
  NOT_STARTED: 'NOT_STARTED',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  EXPIRED: 'EXPIRED',
} as const;

export type SessionStatusType = (typeof SessionStatus)[keyof typeof SessionStatus];

export const QuestionSource = {
  AI: 'AI',
  MANUAL: 'MANUAL',
} as const;

export type QuestionSourceType = (typeof QuestionSource)[keyof typeof QuestionSource];

export const TIMEZONE = 'Asia/Kolkata';

export const QUIZ_GENERATION_CRON = '0 19 * * *';
export const QUIZ_DELIVERY_CRON = '0 20 * * *';
