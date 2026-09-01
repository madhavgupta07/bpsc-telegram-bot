import { useEffect, useState, type FormEvent } from 'react';

import { api } from '../services/api';
import { Modal, Spinner, EmptyState, Badge, statusTone } from '../components/ui';
import { useToast } from '../components/Toast';
import type { Quiz, Paginated } from '../types';

interface QuizDetail extends Quiz {
  questions?: unknown[];
}

const TOPIC_CARDS = [
  { name: 'Operating Systems', icon: '🖥', color: 'blue' },
  { name: 'Computer Networks', icon: '🌐', color: 'green' },
  { name: 'Data Structures', icon: '📊', color: 'purple' },
  { name: 'Algorithms', icon: '⚡', color: 'orange' },
  { name: 'Digital Logic', icon: '🔢', color: 'red' },
  { name: 'DBMS', icon: '🗄', color: 'teal' },
  { name: 'COA', icon: '🏗', color: 'indigo' },
] as const;

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function todayIST(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

export default function DailyQuizzes() {
  const toast = useToast();
  const [data, setData] = useState<Paginated<Quiz> | null>(null);
  const [loading, setLoading] = useState(true);
  const [topicCounts, setTopicCounts] = useState<Record<string, number>>({});
  const [detail, setDetail] = useState<QuizDetail | null>(null);
  const [startingDate, setStartingDate] = useState<string | null>(null);

  // Generation modal state
  const [genOpen, setGenOpen] = useState(false);
  const [genTopic, setGenTopic] = useState('');
  const [genCount, setGenCount] = useState(10);
  const [genDate, setGenDate] = useState(() => addDays(todayIST(), 1));
  const [genEasy, setGenEasy] = useState(30);
  const [genMedium, setGenMedium] = useState(50);
  const [genHard, setGenHard] = useState(20);
  const [generating, setGenerating] = useState(false);

  const load = async (page = 1, limit = 25) => {
    setLoading(true);
    try {
      const [quizRes, countsRes] = await Promise.all([
        api.quizzes(page, limit),
        api.topicQuestionCounts(),
      ]);
      setData(quizRes.data);
      setTopicCounts(countsRes.data);
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

  const openGenModal = (topicName: string) => {
    setGenTopic(topicName);
    setGenCount(10);
    setGenDate(addDays(todayIST(), 1));
    setGenEasy(30);
    setGenMedium(50);
    setGenHard(20);
    setGenOpen(true);
  };

  const openMixedGenModal = () => {
    setGenTopic('');
    setGenCount(10);
    setGenDate(addDays(todayIST(), 1));
    setGenEasy(30);
    setGenMedium(50);
    setGenHard(20);
    setGenOpen(true);
  };

  const handleDifficultyChange = (
    which: 'easy' | 'medium' | 'hard',
    value: number
  ) => {
    // Normalize so all three sum to 100
    if (which === 'easy') {
      const remaining = 100 - value;
      const ratio = genMedium + genHard > 0 ? remaining / (genMedium + genHard) : 0;
      setGenEasy(value);
      setGenMedium(Math.round(genMedium * ratio));
      setGenHard(Math.round(genHard * ratio));
    } else if (which === 'medium') {
      const remaining = 100 - value;
      const ratio = genEasy + genHard > 0 ? remaining / (genEasy + genHard) : 0;
      setGenMedium(value);
      setGenEasy(Math.round(genEasy * ratio));
      setGenHard(Math.round(genHard * ratio));
    } else {
      const remaining = 100 - value;
      const ratio = genEasy + genMedium > 0 ? remaining / (genEasy + genMedium) : 0;
      setGenHard(value);
      setGenEasy(Math.round(genEasy * ratio));
      setGenMedium(Math.round(genMedium * ratio));
    }
  };

  const handleGenerate = async (e: FormEvent) => {
    e.preventDefault();
    setGenerating(true);
    try {
      const topicDistribution: Record<string, number> = {};
      if (genTopic) {
        topicDistribution[genTopic] = genCount;
      } else {
        // Mixed: distribute evenly across all topics
        const perTopic = Math.max(1, Math.floor(genCount / TOPIC_CARDS.length));
        for (const t of TOPIC_CARDS) {
          topicDistribution[t.name] = perTopic;
        }
      }

      const total = genEasy + genMedium + genHard || 100;
      await api.generateQuiz({
        date: genDate,
        totalQuestions: genCount,
        topicDistribution,
        difficultyDistribution: {
          easy: genEasy / total,
          medium: genMedium / total,
          hard: genHard / total,
        },
        regenerate: true,
      });

      toast('Quiz generated successfully!', 'success');
      setGenOpen(false);
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
      {/* ─── Topic Cards Section ─── */}
      <div className="section-header">
        <div>
          <h2>🎯 Generate Quiz by Topic</h2>
          <p>Click a topic to generate AI-powered questions</p>
        </div>
      </div>

      <div className="topic-grid">
        {TOPIC_CARDS.map((t) => (
          <div
            key={t.name}
            className="topic-card"
            data-color={t.color}
            onClick={() => openGenModal(t.name)}
          >
            <div className="topic-card-icon">{t.icon}</div>
            <div className="topic-card-name">{t.name}</div>
            <div className="topic-card-count">
              {topicCounts[t.name] ?? 0} questions in bank
            </div>
            <div className="topic-card-btn">⚡ Generate Quiz</div>
          </div>
        ))}
        <div
          className="topic-card"
          data-color="gradient"
          onClick={openMixedGenModal}
        >
          <div className="topic-card-icon">📚</div>
          <div className="topic-card-name">Mixed (All Topics)</div>
          <div className="topic-card-count">
            {Object.values(topicCounts).reduce((a, b) => a + b, 0)} total questions
          </div>
          <div className="topic-card-btn">⚡ Generate Quiz</div>
        </div>
      </div>

      {/* ─── Quiz History Section ─── */}
      <div className="section-header">
        <div>
          <h2>📋 Quiz History</h2>
        </div>
      </div>

      {loading ? (
        <Spinner />
      ) : !data || data.data.length === 0 ? (
        <EmptyState
          title="No quizzes yet"
          description="Click a topic above to generate your first quiz."
        />
      ) : (
        <div className="card table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Topics</th>
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
                  <td>
                    {q.topicDistribution
                      ? Object.keys(q.topicDistribution).join(', ')
                      : '—'}
                  </td>
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

      {/* ─── Generation Modal ─── */}
      {genOpen && (
        <div className="modal-overlay gen-modal" onClick={() => !generating && setGenOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            {generating ? (
              <div className="gen-progress">
                <div className="gen-progress-icon">🤖</div>
                <div className="gen-progress-text">AI is generating questions...</div>
                <div className="gen-progress-sub">
                  {genTopic || 'Mixed Topics'} · {genCount} questions
                </div>
                <div className="gen-progress-bar">
                  <div className="gen-progress-bar-fill" />
                </div>
              </div>
            ) : (
              <>
                <div className="modal-header">
                  <h3>
                    {genTopic
                      ? `Generate ${genTopic} Quiz`
                      : 'Generate Mixed Quiz'}
                  </h3>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => setGenOpen(false)}
                    style={{ minWidth: 'auto', padding: '0.2rem 0.5rem' }}
                  >
                    ✕
                  </button>
                </div>

                <form onSubmit={handleGenerate}>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Number of Questions</label>
                      <select
                        value={genCount}
                        onChange={(e) => setGenCount(Number(e.target.value))}
                      >
                        <option value={10}>10 Questions</option>
                        <option value={15}>15 Questions</option>
                        <option value={20}>20 Questions</option>
                        <option value={25}>25 Questions</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Quiz Date</label>
                      <input
                        type="date"
                        value={genDate}
                        onChange={(e) => setGenDate(e.target.value)}
                        min={todayIST()}
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Difficulty Distribution</label>
                    <div className="difficulty-sliders">
                      <div className="slider-group easy">
                        <div className="slider-label">Easy</div>
                        <input
                          type="range"
                          min={0}
                          max={100}
                          value={genEasy}
                          onChange={(e) =>
                            handleDifficultyChange('easy', Number(e.target.value))
                          }
                        />
                        <div className="slider-value">{genEasy}%</div>
                      </div>
                      <div className="slider-group medium">
                        <div className="slider-label">Medium</div>
                        <input
                          type="range"
                          min={0}
                          max={100}
                          value={genMedium}
                          onChange={(e) =>
                            handleDifficultyChange('medium', Number(e.target.value))
                          }
                        />
                        <div className="slider-value">{genMedium}%</div>
                      </div>
                      <div className="slider-group hard">
                        <div className="slider-label">Hard</div>
                        <input
                          type="range"
                          min={0}
                          max={100}
                          value={genHard}
                          onChange={(e) =>
                            handleDifficultyChange('hard', Number(e.target.value))
                          }
                        />
                        <div className="slider-value">{genHard}%</div>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => setGenOpen(false)}
                    >
                      Cancel
                    </button>
                    <button type="submit" className="btn btn-primary">
                      🤖 Generate Quiz
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}

      {/* ─── Preview Modal ─── */}
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
