import type { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';

import { AppError, sendError } from '../utils/ApiError';
import { logger } from '../utils/logger';
import { env } from '../config/env';

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
    errorCode: 'NOT_FOUND',
  });
}

export function errorHandler(
  error: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (error instanceof AppError) {
    sendError(res, error);
    return;
  }

  if (error instanceof mongoose.Error.ValidationError) {
    const details = Object.values(error.errors).map((e) => e.message);
    sendError(res, new AppError('Validation error', 400, 'VALIDATION_ERROR', details));
    return;
  }

  if (error instanceof mongoose.Error.CastError) {
    sendError(res, new AppError(`Invalid ${error.path} value`, 400, 'VALIDATION_ERROR'));
    return;
  }

  if (error instanceof SyntaxError && 'body' in error) {
    sendError(res, new AppError('Malformed JSON request body', 400, 'BAD_REQUEST'));
    return;
  }

  if (typeof error === 'object' && error !== null && 'code' in error && (error as any).code === 11000) {
    sendError(res, new AppError('Duplicate value, resource already exists', 409, 'CONFLICT'));
    return;
  }

  logger.error('Unhandled error', error instanceof Error ? error : undefined, {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
  });

  const message =
    env.nodeEnv === 'production' ? 'Internal server error' : (error as Error)?.message ?? 'Error';

  res.status(500).json({
    success: false,
    message,
    errorCode: 'INTERNAL_ERROR',
  });
}
