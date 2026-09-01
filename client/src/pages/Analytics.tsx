import { useEffect, useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  Cell,
} from 'recharts';

import { api } from '../services/api';
import { Spinner, EmptyState } from '../components/ui';
import { useToast } from '../components/Toast';
import type { DailyParticipationPoint, TopicPerformance } from '../types';

const COLORS = ['#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16', '#22c55e', '#10b981'];

export default function Analytics() {
  const toast = useToast();
  const [participation, setParticipation] = useState<DailyParticipationPoint[]>([]);
  const [topics, setTopics] = useState<TopicPerformance[]>([]);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.dailyParticipation(30),
      api.topicPerformance(),
      api.leaderboard('accuracy'),
    ])
      .then(([p, t, l]) => {
        setParticipation(p.data);
        setTopics(t.data);
        setLeaderboard(l.data as any[]);
      })
      .catch(() => toast('Failed to load analytics', 'error'))
      .finally(() => setLoading(false));
  }, [toast]);

  if (loading) return <Spinner />;

  const hasParticipation = participation.length > 0 && participation.some((p) => p.participants > 0);
  const hasTopics = topics.length > 0;

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>Analytics</h2>

      <div className="grid-2">
        <div className="card">
          <div className="card-title">Daily Participation (30 days)</div>
          {!hasParticipation ? (
            <EmptyState title="No participation data yet" />
          ) : (
            <div style={{ width: '100%', height: 260 }}>
              <ResponsiveContainer>
                <LineChart data={participation}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="participants"
                    stroke="#4f46e5"
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-title">Most Difficult Topics</div>
          {!hasTopics ? (
            <EmptyState title="No topic data yet" />
          ) : (
            <div style={{ width: '100%', height: 260 }}>
              <ResponsiveContainer>
                <BarChart data={topics.slice(0, 10)} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" domain={[0, 100]} />
                  <YAxis type="category" dataKey="topic" width={140} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="accuracy" radius={[0, 4, 4, 0]}>
                    {topics.slice(0, 10).map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-title">Leaderboard (by Accuracy)</div>
        {leaderboard.length === 0 ? (
          <EmptyState title="No leaderboard data yet" />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>User</th>
                  <th>Accuracy</th>
                  <th>Streak</th>
                  <th>Quizzes</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((u) => (
                  <tr key={u.rank}>
                    <td>#{u.rank}</td>
                    <td>{u.telegramUsername ? `@${u.telegramUsername}` : u.firstName || '—'}</td>
                    <td>{u.accuracy}%</td>
                    <td>{u.currentStreak}</td>
                    <td>{u.totalQuizzes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
