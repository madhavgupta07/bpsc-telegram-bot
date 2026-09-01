import { useEffect, useState, type FormEvent } from 'react';

import { api } from '../services/api';
import { Modal, Spinner, EmptyState, Badge, diffTone } from '../components/ui';
import { useToast } from '../components/Toast';
import type { Question, Topic, Paginated, Difficulty } from '../types';

const emptyForm: {
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
  topic: string;
  subtopic: string;
  difficulty: Difficulty;
} = {
  question: '',
  options: ['', '', '', ''],
  correctAnswer: '',
  explanation: '',
  topic: '',
  subtopic: '',
  difficulty: 'medium',
};

export default function Questions() {
  const toast = useToast();
  const [data, setData] = useState<Paginated<Question> | null>(null);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [topicFilter, setTopicFilter] = useState('');
  const [difficultyFilter, setDifficultyFilter] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Question | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [preview, setPreview] = useState<Question | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async (p = page) => {
    setLoading(true);
    try {
      const res = await api.questions({
        page: p,
        limit: 15,
        search,
        topic: topicFilter,
        difficulty: difficultyFilter,
      });
      setData(res.data);
      setPage(p);
    } catch {
      toast('Failed to load questions', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    api
      .topics()
      .then((res) => setTopics(res.data))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => load(1), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, topicFilter, difficultyFilter]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (q: Question) => {
    setEditing(q);
    setForm({
      question: q.question,
      options: [...q.options],
      correctAnswer: q.correctAnswer,
      explanation: q.explanation,
      topic: q.topic,
      subtopic: q.subtopic,
      difficulty: q.difficulty,
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const body = {
        question: form.question,
        options: form.options.map((o) => o.trim()).filter((o) => o.length > 0),
        correctAnswer: form.correctAnswer.trim(),
        explanation: form.explanation,
        topic: form.topic.trim(),
        subtopic: form.subtopic.trim(),
        difficulty: form.difficulty,
      };
      if (editing) {
        await api.updateQuestion(editing.id, body);
        toast('Question updated', 'success');
      } else {
        await api.createQuestion(body);
        toast('Question created', 'success');
      }
      setModalOpen(false);
      load(page);
    } catch (err: any) {
      toast(err?.message ?? 'Failed to save question', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (q: Question) => {
    if (!window.confirm('Deactivate this question?')) return;
    try {
      await api.deleteQuestion(q.id);
      toast('Question deactivated', 'success');
      load(page);
    } catch {
      toast('Failed to deactivate', 'error');
    }
  };

  const handleVerify = async (q: Question) => {
    try {
      await api.verifyQuestion(q.id);
      toast('Question verified', 'success');
      load(page);
    } catch {
      toast('Failed to verify', 'error');
    }
  };

  return (
    <div>
      <div className="filters">
        <input
          placeholder="Search questions..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select value={topicFilter} onChange={(e) => setTopicFilter(e.target.value)}>
          <option value="">All topics</option>
          {topics.map((t) => (
            <option key={t.id} value={t.name}>
              {t.name}
            </option>
          ))}
        </select>
        <select value={difficultyFilter} onChange={(e) => setDifficultyFilter(e.target.value)}>
          <option value="">All difficulties</option>
          <option value="easy">Easy</option>
          <option value="medium">Medium</option>
          <option value="hard">Hard</option>
        </select>
        <button className="btn btn-primary" onClick={openCreate}>
          + New Question
        </button>
      </div>

      {loading ? (
        <Spinner />
      ) : !data || data.data.length === 0 ? (
        <EmptyState title="No questions" description="Create or generate questions to get started." />
      ) : (
        <div className="card table-wrap">
          <table>
            <thead>
              <tr>
                <th>Question</th>
                <th>Topic</th>
                <th>Difficulty</th>
                <th>Status</th>
                <th>Used</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.data.map((q) => (
                <tr key={q.id}>
                  <td style={{ maxWidth: 380 }}>{q.question}</td>
                  <td>{q.topic}</td>
                  <td>
                    <Badge tone={diffTone(q.difficulty)}>{q.difficulty}</Badge>
                  </td>
                  <td>
                    <Badge tone={q.isVerified ? 'green' : q.isActive ? 'yellow' : 'red'}>
                      {q.isVerified ? 'Verified' : q.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </td>
                  <td>{q.usedCount}</td>
                  <td>
                    <button className="btn btn-secondary btn-sm" onClick={() => setPreview(q)}>
                      View
                    </button>{' '}
                    <button className="btn btn-secondary btn-sm" onClick={() => openEdit(q)}>
                      Edit
                    </button>{' '}
                    {!q.isVerified && (
                      <button className="btn btn-success btn-sm" onClick={() => handleVerify(q)}>
                        Verify
                      </button>
                    )}{' '}
                    <button className="btn btn-danger btn-sm" onClick={() => handleDelete(q)}>
                      Del
                    </button>
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

      {preview && (
        <Modal title="Question Preview" onClose={() => setPreview(null)}>
          <div className="mono" style={{ marginBottom: '0.5rem' }}>
            [{preview.topic}] · {preview.subtopic || 'general'} · {preview.difficulty}
          </div>
          <p>
            <strong>{preview.question}</strong>
          </p>
          <ol style={{ paddingLeft: '1.25rem' }}>
            {preview.options.map((o) => (
              <li key={o} style={{ color: o === preview.correctAnswer ? 'green' : 'inherit', fontWeight: o === preview.correctAnswer ? 600 : 400 }}>
                {o}
                {o === preview.correctAnswer ? ' ✓' : ''}
              </li>
            ))}
          </ol>
          <p style={{ background: '#f9fafb', padding: '0.75rem', borderRadius: '0.4rem' }}>
            {preview.explanation}
          </p>
        </Modal>
      )}

      {modalOpen && (
        <Modal title={editing ? 'Edit Question' : 'New Question'} onClose={() => setModalOpen(false)}>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Question</label>
              <textarea
                rows={2}
                value={form.question}
                onChange={(e) => setForm({ ...form, question: e.target.value })}
                required
              />
            </div>
            {form.options.map((opt, i) => (
              <div className="form-group" key={i}>
                <label>Option {String.fromCharCode(65 + i)}</label>
                <input
                  value={opt}
                  onChange={(e) => {
                    const options = [...form.options];
                    options[i] = e.target.value;
                    setForm({ ...form, options });
                  }}
                  required
                />
              </div>
            ))}
            <div className="form-group">
              <label>Correct Answer</label>
              <select
                value={form.correctAnswer}
                onChange={(e) => setForm({ ...form, correctAnswer: e.target.value })}
                required
              >
                <option value="">Select correct answer</option>
                {form.options
                  .filter((o) => o.trim())
                  .map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
              </select>
            </div>
            <div className="form-group">
              <label>Explanation</label>
              <textarea
                rows={3}
                value={form.explanation}
                onChange={(e) => setForm({ ...form, explanation: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label>Topic</label>
              <input
                list="topic-options"
                value={form.topic}
                onChange={(e) => setForm({ ...form, topic: e.target.value })}
                required
              />
              <datalist id="topic-options">
                {topics.map((t) => (
                  <option key={t.id} value={t.name} />
                ))}
              </datalist>
            </div>
            <div className="form-group">
              <label>Subtopic</label>
              <input value={form.subtopic} onChange={(e) => setForm({ ...form, subtopic: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Difficulty</label>
              <select
                value={form.difficulty}
                onChange={(e) => setForm({ ...form, difficulty: e.target.value as any })}
              >
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
