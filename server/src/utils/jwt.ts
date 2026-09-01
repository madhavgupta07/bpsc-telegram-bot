import jwt, { type SignOptions, type JwtPayload } from 'jsonwebtoken';

import { env } from '../config/env';

export interface AuthTokenPayload {
  sub: string;
  username: string;
  role: 'admin';
}

export function signToken(payload: AuthTokenPayload): string {
  const options: SignOptions = {
    expiresIn: env.jwtExpiresIn as SignOptions['expiresIn'],
  };
  return jwt.sign(payload, env.jwtSecret, options);
}

export function verifyToken(token: string): AuthTokenPayload {
  const decoded = jwt.verify(token, env.jwtSecret) as JwtPayload;
  return {
    sub: String(decoded.sub),
    username: String(decoded.username),
    role: 'admin',
  };
}

export function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  if (!cookieHeader) return {};
  const result: Record<string, string> = {};
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx > 0) {
      const key = part.slice(0, idx).trim();
      const value = part.slice(idx + 1).trim();
      result[key] = decodeURIComponent(value);
    }
  }
  return result;
}
