import { env } from '../config/env';
import { logger } from '../utils/logger';
import { AppError } from '../utils/ApiError';
import type { Difficulty } from '../config/constants';

export interface AiQuestion {
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
  topic: string;
  subtopic: string;
  difficulty: Difficulty;
}

interface OpenRouterMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OpenRouterRequestBody {
  model: string;
  messages: OpenRouterMessage[];
  response_format?: { type: 'json_object' };
  temperature: number;
  max_tokens: number;
}

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MAX_RETRIES = 3;
const REQUIRED_FIELDS = ['question', 'options', 'correctAnswer', 'explanation', 'topic', 'subtopic', 'difficulty'] as const;

export function isOpenRouterConfigured(): boolean {
  return Boolean(env.openRouterApiKey);
}

export function validateAiQuestion(q: unknown): q is AiQuestion {
  if (typeof q !== 'object' || q === null) return false;
  const obj = q as Record<string, unknown>;

  for (const field of REQUIRED_FIELDS) {
    if (obj[field] === undefined || obj[field] === null) return false;
  }

  const question = obj.question;
  if (typeof question !== 'string' || question.trim().length === 0) return false;

  const options = obj.options;
  if (!Array.isArray(options) || options.length !== 4) return false;
  if (!options.every((o) => typeof o === 'string' && o.trim().length > 0)) return false;

  const uniqueOptions = new Set(options.map((o) => (o as string).trim().toLowerCase()));
  if (uniqueOptions.size !== 4) return false;

  const correctAnswer = obj.correctAnswer;
  if (typeof correctAnswer !== 'string') return false;

  const normalizedOptions = options.map((o) => (o as string).trim().toLowerCase());
  if (!normalizedOptions.includes(correctAnswer.trim().toLowerCase())) return false;

  const explanation = obj.explanation;
  if (typeof explanation !== 'string' || explanation.trim().length === 0) return false;

  const topic = obj.topic;
  const subtopic = obj.subtopic;
  if (typeof topic !== 'string' || typeof subtopic !== 'string') return false;

  const difficulty = obj.difficulty;
  if (difficulty !== 'easy' && difficulty !== 'medium' && difficulty !== 'hard') return false;

  return true;
}

function buildSystemPrompt(
  topicContext: string,
  difficultyDistribution: Record<string, number>,
  count: number
): string {
  return `You are an expert Bihar STET Computer Science question generator.

Your task is to generate exactly ${count} high-quality multiple-choice questions for the Bihar STET (State Teacher Eligibility Test) Computer Science exam.

STRICT REQUIREMENTS for EVERY question:
1. Exactly 4 options
2. Exactly 1 correct answer
3. No duplicate options
4. No ambiguous answers
5. Correct answer must be objectively verifiable and based on standard Computer Science facts
6. Explanation must clearly justify the correct answer and match it
7. Question must belong to the selected topic: ${topicContext}
8. Avoid questions that are too trivial or too obscure
9. Avoid inventing facts - use established, verifiable facts
10. Avoid misleading wording
11. Numerical questions must be independently verifiable
12. The correct answer MUST be present among the 4 options
13. Difficulty distribution must approximately follow: ${JSON.stringify(difficultyDistribution)}

You MUST respond with ONLY a valid JSON object in this exact structure:
{
  "questions": [
    {
      "question": "The question text",
      "options": ["option1", "option2", "option3", "option4"],
      "correctAnswer": "the correct option text (must match one of options exactly)",
      "explanation": "Explanation of why this is correct",
      "topic": "main topic name",
      "subtopic": "specific subtopic name",
      "difficulty": "easy" | "medium" | "hard"
    }
  ]
}

Do not include any text outside the JSON object.`;
}

function buildUserPrompt(
  topicContext: string,
  count: number,
  avoidTopics: string[]
): string {
  let prompt = `Generate ${count} Bihar STET Computer Science MCQs for topic context: ${topicContext}.`;

  if (avoidTopics.length > 0) {
    prompt += ` Do NOT generate questions related to any of these recently tested subtopics: ${avoidTopics.join(', ')}.`;
  }

  prompt += ` Return a JSON object with a "questions" array containing ${count} question objects.`;
  return prompt;
}

async function callOpenRouter(payload: OpenRouterRequestBody): Promise<unknown> {
  const started = Date.now();
  const response = await fetch(OPENROUTER_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.openRouterApiKey}`,
      'HTTP-Referer': env.serverUrl,
      'X-Title': 'Bihar STET Quiz Bot',
    },
    body: JSON.stringify(payload),
  });

  const duration = Date.now() - started;

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    logger.error('OpenRouter API error', undefined, {
      status: response.status,
      durationMs: duration,
      bodySnippet: body.slice(0, 500),
    });
    throw new AppError('OpenRouter API error', 502, 'INTERNAL_ERROR');
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    logger.error('OpenRouter returned empty content', undefined, { durationMs: duration });
    throw new AppError('Empty AI response', 502, 'INTERNAL_ERROR');
  }

  return parseJsonContent(content);
}

function parseJsonContent(content: string): unknown {
  const trimmed = content.trim();

  try {
    return JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        throw new AppError('Malformed AI JSON response', 502, 'INTERNAL_ERROR');
      }
    }
    throw new AppError('Malformed AI JSON response', 502, 'INTERNAL_ERROR');
  }
}

export interface GenerateOptions {
  topicContext: string;
  difficultyDistribution?: Record<string, number>;
  count?: number;
  avoidSubtopic?: string[];
  temperature?: number;
}

export async function generateQuestions(options: GenerateOptions): Promise<AiQuestion[]> {
  if (!isOpenRouterConfigured()) {
    throw new AppError(
      'OPENROUTER_API_KEY environment variable is required to generate AI questions',
      500,
      'QUIZ_GENERATION_FAILED'
    );
  }

  const count = options.count ?? 10;
  const temperature = options.temperature ?? 0.7;
  const difficultyDistribution = options.difficultyDistribution ?? { easy: 0.3, medium: 0.5, hard: 0.2 };

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const systemPrompt = buildSystemPrompt(
        options.topicContext,
        difficultyDistribution,
        count
      );
      const userPrompt = buildUserPrompt(
        options.topicContext,
        count,
        options.avoidSubtopic ?? []
      );

      const result = await callOpenRouter({
        model: env.openRouterModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
        temperature,
        max_tokens: 4096,
      });

      const questions = extractQuestions(result);

      if (questions.length === 0) {
        throw new AppError('AI returned no questions', 502, 'QUIZ_GENERATION_FAILED');
      }

      const validQuestions = questions.filter(validateAiQuestion);
      if (validQuestions.length < count) {
        logger.warn(`AI returned only ${validQuestions.length}/${count} valid questions on attempt ${attempt}`);
      }

      if (validQuestions.length > 0) {
        logger.info(`Generated ${validQuestions.length} valid questions (attempt ${attempt})`, {
          attempt,
          valid: validQuestions.length,
          durationMs: undefined,
        });
        return validQuestions.slice(0, count);
      }

      throw new AppError('All AI questions failed validation', 502, 'QUIZ_VALIDATION_FAILED');
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown AI error');
      logger.warn(`Question generation attempt ${attempt} failed`, {
        attempt,
        error: lastError.message,
      });
      if (attempt === MAX_RETRIES) break;
      await sleep(500 * attempt);
    }
  }

  throw lastError ?? new AppError('Question generation failed', 502, 'QUIZ_GENERATION_FAILED');
}

function extractQuestions(result: unknown): AiQuestion[] {
  if (typeof result !== 'object' || result === null) return [];
  const obj = result as Record<string, unknown>;

  const rawQuestions = Array.isArray(obj.questions) ? obj.questions : [];

  const questions: AiQuestion[] = [];
  for (const raw of rawQuestions) {
    if (validateAiQuestion(raw)) {
      questions.push(raw as AiQuestion);
    }
  }
  return questions;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
