import { useEffect, useState } from 'react';

import { api } from '../services/api';
import { Spinner, EmptyState, Badge } from '../components/ui';
import { useToast } from '../components/Toast';
import type { User, Paginated } from '../types';

export default function Users() {
  const toast = useToast();
  const [data, setData] = useState<Paginated<User> | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  const load = async (p = 1) => {
    setLoading(true);
    try {
      const res = await api.users(p, 20);
      setData(res.data);
      setPage(p);
    } catch {
      toast('Failed to load users', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>Users</h2>
      {loading ? (
        <Spinner />
      ) : !data || data.data.length === 0 ? (
        <EmptyState title="No users yet" description="Users appear after they start the Telegram bot." />
      ) : (
        <div className="card table-wrap">
          <table>
            <thead>
              <tr>
                <th>Telegram</th>
                <th>Name</th>
                <th>Quizzes</th>
                <th>Accuracy</th>
                <th>Streak</th>
                <th>Status</th>
                <th>Last Active</th>
              </tr>
            </thead>
            <tbody>
              {data.data.map((u) => (
                <tr key={u.id}>
                  <td>{u.telegramUsername ? `@${u.telegramUsername}` : u.telegramId}</td>
                  <td>{[u.firstName, u.lastName].filter(Boolean).join(' ') || '—'}</td>
                  <td>{u.totalQuizzes}</td>
                  <td>{u.accuracy}%</td>
                  <td>
                    {u.currentStreak > 0 ? `🔥 ${u.currentStreak}` : '0'}
                  </td>
                  <td>
                    <Badge tone={u.isActive ? 'green' : 'red'}>
                      {u.isActive ? 'Active' : 'Blocked'}
                    </Badge>
                  </td>
                  <td>
                    {u.lastActiveAt
                      ? new Date(u.lastActiveAt).toLocaleDateString()
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.totalPages > 1 && (
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
              <button
                className="btn btn-secondary btn-sm"
                disabled={page <= 1}
                onClick={() => load(page - 1)}
              >
                Prev
              </button>
              <span style={{ alignSelf: 'center', fontSize: '0.85rem' }}>
                Page {page} / {data.totalPages}
              </span>
              <button
                className="btn btn-secondary btn-sm"
                disabled={page >= data.totalPages}
                onClick={() => load(page + 1)}
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
