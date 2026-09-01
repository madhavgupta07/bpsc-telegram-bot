import { useEffect, useState } from 'react';

import { api } from '../services/api';
import { Modal, Spinner, EmptyState, Badge, statusTone } from '../components/ui';
import { useToast } from '../components/Toast';
import type { Quiz, Paginated } from '../types';

interface QuizDetail extends Quiz {
  questions?: unknown[];
}

export default function DailyQuizzes() {
  const toast = useToast();
  const [data, setData] = useState<Paginated<Quiz> | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [startingDate, setStartingDate] = useState<string | null>(null);
  const [detail, setDetail] = useState<QuizDetail | null>(null);

  const load = async (page = 1, limit = 25) => {
    setLoading(true);
    try {
      const res = await api.quizzes(page, limit);
      setData(res.data);
    } catch {
      toast('Failed to load quizzes', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleGenerate = async () => {
    if (!window.confirm('Generate tomorrow\'s quiz now (10 AI questions)?')) return;
    setGenerating(true);
    try {
      await api.generateQuiz({});
      toast('Quiz generation triggered', 'success');
      load();
    } catch (err: any) {
      toast(err?.message ?? 'Generation failed', 'error');
    } finally {
      setGenerating(false);
    }
  };

  const handlePublish = async (q: Quiz) => {
    try {
      await api.publishQuiz(q.date);
      toast('Quiz published', 'success');
      load();
    } catch (err: any) {
      toast(err?.message ?? 'Failed to publish', 'error');
    }
  };

  const handleUnpublish = async (q: Quiz) => {
    try {
      await api.unpublishQuiz(q.date);
      toast('Quiz unpublished', 'success');
      load();
    } catch {
      toast('Failed to unpublish', 'error');
    }
  };

  const handlePreview = async (q: Quiz) => {
    try {
      const res = await api.quiz(q.date);
      setDetail(res.data as QuizDetail);
    } catch {
      toast('Failed to load quiz preview', 'error');
    }
  };

  const handleStart = async (q: Quiz) => {
    if (!window.confirm(`Send the ${q.date} quiz to all subscribed Telegram users now?`)) return;
    setStartingDate(q.date);
    try {
      const res = await api.startQuiz(q.date);
      toast(
        `Delivered to ${res.data.delivered} of ${res.data.attempted} user(s)${res.data.failed ? ` (${res.data.failed} failed)` : ''}`,
        res.data.failed ? 'error' : 'success'
      );
    } catch (err: any) {
      toast(err?.message ?? 'Failed to start quiz', 'error');
    } finally {
      setStartingDate(null);
    }
  };

  return (
    <div>
      <div className="filters" style={{ justifyContent: 'space-between' }}>
        <h2 style={{ margin: 0, fontSize: '1.1rem' }}>Daily Quizzes</h2>
        <button className="btn btn-primary" onClick={handleGenerate} disabled={generating}>
          {generating ? 'Generating...' : '⚙ Generate Tomorrow'}
        </button>
      </div>

      <div className="card" style={{ background: '#eef2ff', borderColor: '#c7d2fe' }}>
        <div className="card-title">How it works</div>
        <p style={{ margin: 0, fontSize: '0.9rem' }}>
          Each day at <strong>7:00 PM IST</strong>, the system generates and validates tomorrow's
          quiz using OpenRouter AI, stores it in MongoDB, and at <strong>8:00 PM IST</strong> the
          Telegram bot delivers it to subscribed users. If AI generation fails, previously validated
          questions are used as a fallback.
        </p>
      </div>

      {loading ? (
        <Spinner />
      ) : !data || data.data.length === 0 ? (
        <EmptyState
          title="No quizzes yet"
          description="Generate tomorrow's quiz to get started."
        />
      ) : (
        <div className="card table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Questions</th>
                <th>Status</th>
                <th>Validation</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.data.map((q) => (
                <tr key={q.id}>
                  <td>{q.date}</td>
                  <td>{q.questionCount}</td>
                  <td>
                    <Badge tone={statusTone(q.status)}>{q.status}</Badge>
                  </td>
                  <td>
                    <Badge tone={q.validationStatus === 'VALIDATED' ? 'green' : 'yellow'}>
                      {q.validationStatus}
                    </Badge>
                  </td>
                  <td>
                    <button className="btn btn-secondary btn-sm" onClick={() => handlePreview(q)}>
                      Preview
                    </button>{' '}
                    {q.status === 'DRAFT' || q.status === 'FAILED' ? (
                      <button className="btn btn-success btn-sm" onClick={() => handlePublish(q)}>
                        Publish
                      </button>
                    ) : (
                      <button className="btn btn-secondary btn-sm" onClick={() => handleUnpublish(q)}>
                        Unpublish
                      </button>
                    )}{' '}
                    {q.status === 'PUBLISHED' && (
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => handleStart(q)}
                        disabled={startingDate === q.date}
                      >
                        {startingDate === q.date ? 'Sending...' : '▶ Start Now'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {detail && (
        <Modal title={`Quiz — ${detail.date}`} onClose={() => setDetail(null)}>
          <p>
            <strong>Status:</strong> {detail.status} · <strong>Validation:</strong>{' '}
            {detail.validationStatus}
          </p>
          {!detail.questions || detail.questions.length === 0 ? (
            <EmptyState title="No questions" />
          ) : (
            <ol style={{ paddingLeft: '1.25rem' }}>
              {(detail.questions as any[]).map((q, i) => (
                <li key={q.id || i} style={{ marginBottom: '0.5rem' }}>
                  <strong>{q.question}</strong>
                  <div className="mono" style={{ color: '#6b7280', marginTop: '0.2rem' }}>
                    [{q.topic}] · {q.difficulty} · Correct: {q.correctAnswer}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </Modal>
      )}
    </div>
  );
}
