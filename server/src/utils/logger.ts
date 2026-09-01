import { env } from '../config/env';

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogPayload {
  [key: string]: unknown;
}

const SENSITIVE_KEYS = [
  'apiKey',
  'api_key',
  'token',
  'secret',
  'password',
  'jwt',
  'authorization',
  'cookie',
];

function redact(value: unknown, key = ''): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === 'object') {
    if (Array.isArray(value)) {
      return value.map((v) => redact(v));
    }
    const obj = value as Record<string, unknown>;
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      result[k] = redact(v, k);
    }
    return result;
  }
  if (typeof value === 'string' && SENSITIVE_KEYS.some((s) => key.toLowerCase().includes(s))) {
    return '[REDACTED]';
  }
  return value;
}

function write(level: LogLevel, message: string, payload?: LogPayload): void {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...(payload ? { payload: redact(payload) } : {}),
  };

  if (level === 'error') {
    console.error(JSON.stringify(entry));
  } else if (level === 'warn') {
    console.warn(JSON.stringify(entry));
  } else if (level === 'debug' && env.nodeEnv === 'development') {
    console.debug(JSON.stringify(entry));
  } else {
    console.log(JSON.stringify(entry));
  }
}

export const logger = {
  info: (message: string, payload?: LogPayload) => write('info', message, payload),
  warn: (message: string, payload?: LogPayload) => write('warn', message, payload),
  error: (message: string, error?: unknown, payload?: LogPayload) => {
    let errPayload: LogPayload | undefined = payload;
    if (error instanceof Error) {
      errPayload = { ...(payload ?? {}), errorName: error.name, errorMessage: error.message };
    } else if (error !== undefined) {
      errPayload = { ...(payload ?? {}), error };
    }
    write('error', message, errPayload);
  },
  debug: (message: string, payload?: LogPayload) => write('debug', message, payload),
};
