import type {
  AuthResponse,
  AdminUser,
  DashboardStats,
  Paginated,
  Question,
  Topic,
  Quiz,
  User,
  DailyParticipationPoint,
  TopicPerformance,
} from '../types';

export const API_BASE = import.meta.env.VITE_API_URL ?? '';

const TOKEN_KEY = 'bpsc_admin_token';

export function getAuthToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setAuthToken(token: string | null): void {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

export class ApiError extends Error {
  status: number;
  errorCode: string;
  details?: unknown;

  constructor(message: string, status: number, errorCode: string, details?: unknown) {
    super(message);
    this.status = status;
    this.errorCode = errorCode;
    this.details = details;
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': options.body ? 'application/json' : 'application/json',
    ...(options.headers as Record<string, string>),
  };

  const token = getAuthToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    credentials: 'include',
  });

  const json = (await response.json().catch(() => ({}))) as Record<string, unknown>;

  if (!response.ok) {
    throw new ApiError(
      (json.message as string) ?? 'Request failed',
      response.status,
      (json.errorCode as string) ?? 'UNKNOWN',
      json.details
    );
  }

  return json as T;
}

export const api = {
  login: (username: string, password: string) =>
    request<AuthResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),

  logout: () => request<{ success: boolean }>('/api/auth/logout', { method: 'POST' }),

  me: () => request<{ success: boolean; data: AdminUser }>('/api/auth/me'),

  dashboard: () =>
    request<{ success: boolean; data: DashboardStats }>('/api/statistics/dashboard'),

  questions: (params: Record<string, string | number | undefined>) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== '') qs.set(k, String(v));
    });
    return request<{ success: boolean; data: Paginated<Question> }>(
      `/api/questions?${qs.toString()}`
    );
  },

  createQuestion: (body: Record<string, unknown>) =>
    request<{ success: boolean; data: { id: string } }>('/api/questions', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  updateQuestion: (id: string, body: Record<string, unknown>) =>
    request<{ success: boolean }>(`/api/questions/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  deleteQuestion: (id: string) =>
    request<{ success: boolean }>(`/api/questions/${id}`, { method: 'DELETE' }),

  verifyQuestion: (id: string) =>
    request<{ success: boolean }>(`/api/questions/${id}/verify`, { method: 'PATCH' }),

  topics: () =>
    request<{ success: boolean; data: Topic[] }>('/api/topics'),

  topicsTree: () =>
    request<{ success: boolean; data: unknown[] }>('/api/topics/tree'),

  createTopic: (body: Record<string, unknown>) =>
    request<{ success: boolean; data: { id: string } }>('/api/topics', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  updateTopic: (id: string, body: Record<string, unknown>) =>
    request<{ success: boolean }>(`/api/topics/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  deleteTopic: (id: string) =>
    request<{ success: boolean }>(`/api/topics/${id}`, { method: 'DELETE' }),

  quizzes: (page = 1, limit = 20) =>
    request<{ success: boolean; data: Paginated<Quiz> }>(
      `/api/quizzes?page=${page}&limit=${limit}`
    ),

  quiz: (date: string) =>
    request<{ success: boolean; data: Quiz & { questions?: unknown[] } }>(
      `/api/quizzes/${date}`
    ),

  generateQuiz: (body: Record<string, unknown>) =>
    request<{ success: boolean; data: { id: string } }>('/api/quizzes/generate', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  publishQuiz: (date: string) =>
    request<{ success: boolean }>(`/api/quizzes/${date}/publish`, { method: 'PATCH' }),

  unpublishQuiz: (date: string) =>
    request<{ success: boolean }>(`/api/quizzes/${date}/unpublish`, { method: 'PATCH' }),

  startQuiz: (date: string) =>
    request<{ success: boolean; data: { attempted: number; delivered: number; failed: number } }>(
      `/api/quizzes/${date}/start`,
      { method: 'POST' }
    ),

  todaysQuiz: () =>
    request<{ success: boolean; data: Quiz | null }>('/api/quizzes/today'),

  users: (page = 1, limit = 20) =>
    request<{ success: boolean; data: Paginated<User> }>(
      `/api/users?page=${page}&limit=${limit}`
    ),

  dailyParticipation: (days = 30) =>
    request<{ success: boolean; data: DailyParticipationPoint[] }>(
      `/api/statistics/analytics/participation?days=${days}`
    ),

  topicPerformance: () =>
    request<{ success: boolean; data: TopicPerformance[] }>(
      '/api/statistics/analytics/topics'
    ),

  leaderboard: (criteria = 'accuracy') =>
    request<{ success: boolean; data: unknown[] }>(
      `/api/statistics/leaderboard?criteria=${criteria}`
    ),
};
