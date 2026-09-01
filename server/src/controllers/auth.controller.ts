import type { Request, Response } from 'express';

import { loginAdmin, getAdminById } from '../services/auth.service';
import { asyncHandler } from '../utils/asyncHandler';
import { isProduction } from '../config/env';

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { username, password } = req.body as { username: string; password: string };

  const result = await loginAdmin({ username, password });

  const cookieOptions = {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax' as const,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  };

  res.cookie('token', result.token, cookieOptions);

  res.json({
    success: true,
    data: {
      token: result.token,
      admin: result.admin,
    },
  });
});

export const logout = asyncHandler(async (_req: Request, res: Response) => {
  res.clearCookie('token', {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
  });
  res.json({ success: true, message: 'Logged out' });
});

export const me = asyncHandler(async (req: Request, res: Response) => {
  if (!req.admin) {
    res.status(401).json({ success: false, message: 'Not authenticated', errorCode: 'AUTH_REQUIRED' });
    return;
  }

  const admin = await getAdminById(req.admin.id);
  if (!admin) {
    res.status(404).json({ success: false, message: 'Admin not found', errorCode: 'NOT_FOUND' });
    return;
  }

  res.json({ success: true, data: admin });
});

export const authController = {
  login,
  logout,
  me,
};
