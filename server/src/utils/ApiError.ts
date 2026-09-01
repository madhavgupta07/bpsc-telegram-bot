import type { Response } from 'express';

export type ErrorCode =
  | 'AUTH_REQUIRED'
  | 'AUTH_INVALID'
  | 'AUTH_TOKEN_EXPIRED'
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'QUIZ_GENERATION_FAILED'
  | 'QUIZ_VALIDATION_FAILED'
  | 'QUIZ_NOT_FOUND'
  | 'QUIZ_ALREADY_ANSWERED'
  | 'SESSION_EXPIRED'
  | 'TELEGRAM_API_ERROR'
  | 'MONGODB_ERROR'
  | 'DUPLICATE_EMAIL'
  | 'INTERNAL_ERROR'
  | 'BAD_REQUEST';

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly errorCode: ErrorCode;
  public readonly isOperational: boolean;
  public readonly details?: unknown;

  constructor(
    message: string,
    statusCode = 500,
    errorCode: ErrorCode = 'INTERNAL_ERROR',
    details?: unknown
  ) {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.isOperational = true;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 400, 'VALIDATION_ERROR', details);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string) {
    super(message, 404, 'NOT_FOUND');
  }
}

export class ConflictError extends AppError {
  constructor(message: string, errorCode: ErrorCode = 'CONFLICT') {
    super(message, 409, errorCode);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required', errorCode: ErrorCode = 'AUTH_REQUIRED') {
    super(message, 401, errorCode);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(message, 403, 'AUTH_INVALID');
  }
}

export function sendError(res: Response, error: AppError): void {
  const payload = {
    success: false,
    message: error.message,
    errorCode: error.errorCode,
    ...(error.details !== undefined ? { details: error.details } : {}),
  };
  res.status(error.statusCode).json(payload);
}
