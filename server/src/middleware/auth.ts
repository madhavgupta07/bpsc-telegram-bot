import type { Request, Response, NextFunction } from 'express';

import { verifyToken, parseCookies } from '../utils/jwt';
import { UnauthorizedError } from '../utils/ApiError';

declare global {
  namespace Express {
    interface Request {
      admin?: {
        id: string;
        username: string;
        role: 'admin';
      };
    }
  }
}

export function extractToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }

  const cookies = parseCookies(req.headers.cookie);
  if (cookies.token) {
    return cookies.token;
  }

  return null;
}

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  try {
    const token = extractToken(req);
    if (!token) {
      throw new UnauthorizedError('Authentication required', 'AUTH_REQUIRED');
    }

    const payload = verifyToken(token);
    req.admin = {
      id: payload.sub,
      username: payload.username,
      role: 'admin',
    };
    next();
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      next(error);
      return;
    }
    next(new UnauthorizedError('Invalid or expired token', 'AUTH_TOKEN_EXPIRED'));
  }
}
