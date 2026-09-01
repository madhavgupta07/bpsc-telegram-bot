import { describe, it, expect } from 'vitest';

import { validateAiQuestion } from '../services/openrouter.service';
import { validateSingleQuestion } from '../services/questionValidation.service';
import { getDateKey, addDaysToDateKey, isConsecutiveDay, isSameDay } from '../utils/date';

const validBase = {
  question: 'Which CPU scheduling algorithm uses a fixed time quantum?',
  options: ['FCFS', 'SJF', 'Round Robin', 'Priority Scheduling'],
  correctAnswer: 'Round Robin',
  explanation: 'Round Robin assigns each process a fixed time quantum in a cyclic order.',
  topic: 'Operating Systems',
  subtopic: 'CPU Scheduling',
  difficulty: 'easy' as const,
};

describe('AI question validation', () => {
  it('accepts a valid question structure', () => {
    expect(validateAiQuestion(validBase)).toBe(true);
  });

  it('rejects questions with missing options', () => {
    const q = { ...validBase, options: ['FCFS', 'SJF', 'Round Robin'] };
    expect(validateAiQuestion(q)).toBe(false);
  });

  it('rejects questions with more than 4 options', () => {
    const q = { ...validBase, options: [...validBase.options, 'Extra'] };
    expect(validateAiQuestion(q)).toBe(false);
  });

  it('rejects questions with duplicate options', () => {
    const q = { ...validBase, options: ['FCFS', 'FCFS', 'SJF', 'Round Robin'] };
    expect(validateAiQuestion(q)).toBe(false);
  });

  it('rejects questions where correct answer is not among options', () => {
    const q = { ...validBase, correctAnswer: 'Multilevel Queue' };
    expect(validateAiQuestion(q)).toBe(false);
  });

  it('rejects multiple/barely-different correct answers (cast sensitive)', () => {
    const q = {
      ...validBase,
      options: ['Round Robin', 'round robin', 'SJF', 'FCFS'],
    };
    expect(validateAiQuestion(q)).toBe(false);
  });

  it('rejects missing explanation', () => {
    const q = { ...validBase, explanation: '' };
    expect(validateAiQuestion(q)).toBe(false);
  });

  it('rejects invalid difficulty level', () => {
    const q = { ...validBase, difficulty: 'impossible' };
    expect(validateAiQuestion(q)).toBe(false);
  });
});

describe('single question DB validation', () => {
  it('accepts a structurally valid new question', async () => {
    const result = await validateSingleQuestion(validBase);
    expect(result.valid).toBe(true);
  });

  it('flags duplicate options issue', async () => {
    const q = { ...validBase, options: ['A', 'A', 'B', 'C'], correctAnswer: 'A' };
    const result = await validateSingleQuestion(q);
    expect(result.valid).toBe(false);
    expect(result.reasons?.some((r) => r.includes('Duplicate'))).toBe(true);
  });

  it('rejects a too-short trivial question', async () => {
    const q = { ...validBase, question: 'What is 1+1?' };
    const result = await validateSingleQuestion(q);
    expect(result.valid).toBe(false);
  });
});

describe('date utilities', () => {
  it('produces YYYY-MM-DD keys', () => {
    expect(getDateKey(new Date('2026-09-01T12:00:00Z'))).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('adds days to a date key', () => {
    expect(addDaysToDateKey('2026-09-01', 1)).toBe('2026-09-02');
    expect(addDaysToDateKey('2026-02-28', 1)).toBe('2026-03-01');
  });

  it('detects consecutive days', () => {
    expect(isConsecutiveDay('2026-09-01', '2026-09-02')).toBe(true);
    expect(isConsecutiveDay('2026-09-01', '2026-09-03')).toBe(false);
  });

  it('detects same day', () => {
    expect(isSameDay('2026-09-01', '2026-09-01')).toBe(true);
    expect(isSameDay('2026-09-01', '2026-09-02')).toBe(false);
  });
});
