export type Difficulty = 'easy' | 'medium' | 'hard';

export interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface AdminUser {
  id: string;
  username: string;
  name: string;
}

export interface AuthResponse {
  success: boolean;
  data: {
    token: string;
    admin: AdminUser;
  };
}

export interface DashboardStats {
  totalUsers: number;
  activeUsers: number;
  todayQuizStatus: string | null;
  totalQuestions: number;
  quizParticipation: number;
  totalQuizCompletions: number;
  averageScore: number;
  averageAccuracy: number;
  currentStreakSum: number;
  longestStreak: number;
}

export interface Question {
  id: string;
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
  topic: string;
  subtopic: string;
  difficulty: Difficulty;
  source: string;
  aiModel: string | null;
  isVerified: boolean;
  usedCount: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Topic {
  id: string;
  name: string;
  description: string;
  parentTopic: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Quiz {
  id: string;
  date: string;
  status: string;
  validationStatus: string;
  questionCount: number;
  topicDistribution: Record<string, number>;
  generationError: string | null;
  createdAt: string;
}

export interface User {
  id: string;
  telegramId: number;
  telegramUsername: string | null;
  firstName: string | null;
  lastName: string | null;
  isActive: boolean;
  isSubscribed: boolean;
  totalQuizzes: number;
  totalQuestions: number;
  accuracy: number;
  currentStreak: number;
  longestStreak: number;
  lastActiveAt: string | null;
  createdAt: string;
}

export interface DailyParticipationPoint {
  date: string;
  participants: number;
  averageScore: number;
}

export interface TopicPerformance {
  topic: string;
  total: number;
  correct: number;
  accuracy: number;
}
