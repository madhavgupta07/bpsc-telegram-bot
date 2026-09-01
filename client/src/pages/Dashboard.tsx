import { useEffect, useState } from 'react';

import { api } from '../services/api';
import { Spinner, EmptyState } from '../components/ui';
import type { DashboardStats } from '../types';

type BackendStats = DashboardStats | (Record<string, number | string | null> & { todayQuizStatus: string | null });

export default function Dashboard() {
  const [stats, setStats] = useState<BackendStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .dashboard()
      .then((res) => setStats(res.data))
      .catch(() => setError('Failed to load dashboard statistics'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;
  if (error) return <EmptyState title="Error" description={error} />;
  if (!stats) return <EmptyState title="No data" />;

  const num = (v: unknown) => (typeof v === 'number' ? v : Number(v ?? 0));
  const str = (v: unknown) => (typeof v === 'string' ? v : String(v ?? ''));

  const cards = [
    { label: 'Total Users', value: num(stats.totalUsers) },
    { label: 'Active Users', value: num(stats.activeUsers) },
    { label: 'Total Questions', value: num(stats.totalQuestions) },
    { label: 'Quiz Completions', value: num(stats.totalQuizCompletions) },
    { label: 'Avg Score', value: num(stats.averageScore) },
    { label: 'Avg Accuracy', value: `${num(stats.averageAccuracy)}%` },
    { label: 'Longest Streak', value: num(stats.longestStreak) },
  ];

  const todayStatus = str(stats.todayQuizStatus) || 'NONE';

  return (
    <div>
      <div className="card">
        <div className="card-title">Today's Quiz</div>
        <p>
          Status:{' '}
          <strong>{todayStatus}</strong>
        </p>
        <p style={{ color: '#6b7280', fontSize: '0.9rem', marginBottom: 0 }}>
          Daily quiz is generated automatically at 7:00 PM and delivered via Telegram at 8:00 PM IST.
        </p>
      </div>

      <div className="stats-grid">
        {cards.map((c) => (
          <div className="stat" key={c.label}>
            <div className="label">{c.label}</div>
            <div className="value">{c.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
