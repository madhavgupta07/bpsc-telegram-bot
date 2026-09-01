import { Question } from '../models/Question';
import { logger } from '../utils/logger';
import type { AiQuestion } from './openrouter.service';
import { validateAiQuestion } from './openrouter.service';

export interface QuestionValidationResult {
  valid: boolean;
  reasons?: string[];
  duplicateOf?: string | null;
}

export async function validateNewQuestions(
  questions: AiQuestion[]
): Promise<{ valid: AiQuestion[]; rejected: Array<{ reason: string; question?: AiQuestion }> }> {
  const valid: AiQuestion[] = [];
  const rejected: Array<{ reason: string; question?: AiQuestion }> = [];

  for (const q of questions) {
    const result = await validateSingleQuestion(q);
    if (result.valid) {
      valid.push(q);
    } else {
      rejected.push({
        reason: (result.reasons ?? ['validation failed']).join('; '),
        question: q,
      });
    }
  }

  logger.info(`Question validation: ${valid.length} valid, ${rejected.length} rejected`);
  return { valid, rejected };
}

export async function validateSingleQuestion(q: AiQuestion): Promise<QuestionValidationResult> {
  const reasons: string[] = [];

  if (!validateAiQuestion(q)) {
    reasons.push('Failed basic structure validation (4 unique options, 1 correct present, fields present)');
  }

  if (new Set(q.options.map((o) => o.toLowerCase())).size !== 4) {
    reasons.push('Duplicate options detected');
  }

  const duplicate = await Question.findOne({ question: q.question.trim() }).lean();
  if (duplicate) {
    reasons.push('Duplicate of an existing question');
    return { valid: false, reasons, duplicateOf: String(duplicate._id) };
  }

  const lowercaseAnswer = q.correctAnswer.toLowerCase();
  const matchingOptions = q.options.filter((o) => o.toLowerCase() === lowercaseAnswer);
  if (matchingOptions.length !== 1) {
    reasons.push('Correct answer must match exactly one option');
  }

  if (q.explanation.length < 10) {
    reasons.push('Explanation too short');
  }

  if (normalizeText(q.question).length < 15) {
    reasons.push('Question too short or trivial');
  }

  if (reasons.length === 0) {
    return { valid: true, duplicateOf: null };
  }

  return { valid: false, reasons, duplicateOf: null };
}

export async function saveValidatedQuestions(
  questions: AiQuestion[],
  source: 'AI' | 'MANUAL' = 'AI',
  aiModel?: string
): Promise<string[]> {
  const savedIds: string[] = [];

  for (const q of questions) {
    const existing = await Question.findOne({ question: q.question.trim() }).lean();
    if (existing) {
      logger.debug(`Skipping duplicate question during save: ${q.question.slice(0, 40)}`);
      continue;
    }

    const doc = await Question.create({
      question: q.question.trim(),
      options: q.options.map((o) => o.trim()),
      correctAnswer: q.correctAnswer.trim(),
      explanation: q.explanation.trim(),
      topic: q.topic.trim(),
      subtopic: q.subtopic.trim(),
      difficulty: q.difficulty,
      source,
      aiModel: aiModel ?? null,
    });
    savedIds.push(String(doc._id));
  }

  return savedIds;
}

export function sortAiQuestionsByTopic(questions: AiQuestion[], topic: string): AiQuestion[] {
  return questions.filter((q) => q.topic === topic);
}

function normalizeText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}
