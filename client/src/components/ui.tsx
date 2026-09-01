import type { ReactNode } from 'react';

export function Spinner() {
  return <div className="spinner" aria-label="Loading" />;
}

export function EmptyState({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="empty">
      <div className="empty-title">{title}</div>
      {description && <p>{description}</p>}
    </div>
  );
}

export function Badge({
  tone,
  children,
}: {
  tone: 'green' | 'red' | 'yellow' | 'blue' | 'purple';
  children: ReactNode;
}) {
  const map: Record<string, string> = {
    green: 'badge-green',
    red: 'badge-red',
    yellow: 'badge-yellow',
    blue: 'badge-blue',
    purple: 'badge-purple',
  };
  return <span className={`badge ${map[tone]}`}>{children}</span>;
}

export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="btn btn-secondary btn-sm" onClick={onClose}>
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function diffTone(difficulty: string): 'green' | 'yellow' | 'red' {
  if (difficulty === 'easy') return 'green';
  if (difficulty === 'medium') return 'yellow';
  return 'red';
}

export function statusTone(status: string): 'green' | 'red' | 'yellow' | 'blue' {
  switch (status?.toUpperCase()) {
    case 'PUBLISHED':
      return 'green';
    case 'COMPLETED':
      return 'blue';
    case 'FAILED':
    case 'DRAFT':
      return 'red';
    default:
      return 'yellow';
  }
}
