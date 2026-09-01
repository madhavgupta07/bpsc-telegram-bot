import { useEffect, useState, type FormEvent } from 'react';

import { api } from '../services/api';
import { Modal, Spinner, EmptyState, Badge } from '../components/ui';
import { useToast } from '../components/Toast';
import type { Topic } from '../types';

interface TreeNode extends Topic {
  children: TreeNode[];
}

export default function Topics() {
  const toast = useToast();
  const [topics, setTopics] = useState<Topic[]>([]);
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Topic | null>(null);
  const [form, setForm] = useState({ name: '', description: '', parentTopic: '' });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [listRes, treeRes] = await Promise.all([api.topics(), api.topicsTree()]);
      setTopics(listRes.data);
      setTree(treeRes.data as TreeNode[]);
    } catch {
      toast('Failed to load topics', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', description: '', parentTopic: '' });
    setModalOpen(true);
  };

  const openEdit = (t: Topic) => {
    setEditing(t);
    setForm({
      name: t.name,
      description: t.description,
      parentTopic: t.parentTopic ?? '',
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const body = {
        name: form.name.trim(),
        description: form.description.trim(),
        parentTopic: form.parentTopic || null,
      };
      if (editing) {
        await api.updateTopic(editing.id, body);
        toast('Topic updated', 'success');
      } else {
        await api.createTopic(body);
        toast('Topic created', 'success');
      }
      setModalOpen(false);
      load();
    } catch (err: any) {
      toast(err?.message ?? 'Failed to save topic', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (t: Topic) => {
    if (!window.confirm(`Deactivate topic "${t.name}"?`)) return;
    try {
      await api.deleteTopic(t.id);
      toast('Topic deactivated', 'success');
      load();
    } catch (err: any) {
      toast(err?.message ?? 'Failed to deactivate', 'error');
    }
  };

  const flatten = (nodes: TreeNode[], depth = 0): Array<{ node: TreeNode; depth: number }> => {
    const result: Array<{ node: TreeNode; depth: number }> = [];
    for (const n of nodes) {
      result.push({ node: n, depth });
      result.push(...flatten(n.children, depth + 1));
    }
    return result;
  };

  const rows = flatten(tree);

  return (
    <div>
      <div className="filters" style={{ justifyContent: 'space-between' }}>
        <h2 style={{ margin: 0, fontSize: '1.1rem' }}>Topics & Subtopics</h2>
        <button className="btn btn-primary" onClick={openCreate}>
          + New Topic
        </button>
      </div>

      {loading ? (
        <Spinner />
      ) : topics.length === 0 ? (
        <EmptyState title="No topics" description="Create topics to organize questions." />
      ) : (
        <div className="card table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ node, depth }) => (
                <tr key={node.id}>
                  <td style={{ paddingLeft: depth * 24 + 12, fontWeight: depth === 0 ? 600 : 400 }}>
                    {depth > 0 ? '↳ ' : ''}
                    {node.name}
                  </td>
                  <td>{node.parentTopic ? 'Sub-topic' : 'Parent'}</td>
                  <td>
                    <Badge tone={node.isActive ? 'green' : 'red'}>
                      {node.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </td>
                  <td>
                    <button className="btn btn-secondary btn-sm" onClick={() => openEdit(node)}>
                      Edit
                    </button>{' '}
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => {
                        setForm({ name: '', description: '', parentTopic: node.id });
                        setEditing(null);
                        setModalOpen(true);
                      }}
                    >
                      Add Sub
                    </button>{' '}
                    <button className="btn btn-danger btn-sm" onClick={() => handleDelete(node)}>
                      Del
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalOpen && (
        <Modal title={editing ? 'Edit Topic' : 'New Topic'} onClose={() => setModalOpen(false)}>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Name</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label>Description</label>
              <textarea
                rows={2}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Parent Topic (for subtopics)</label>
              <select
                value={form.parentTopic}
                onChange={(e) => setForm({ ...form, parentTopic: e.target.value })}
              >
                <option value="">None (top-level topic)</option>
                {topics
                  .filter((t) => t.id !== editing?.id)
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
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
