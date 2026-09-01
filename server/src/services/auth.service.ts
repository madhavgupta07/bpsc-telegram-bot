import bcrypt from 'bcryptjs';

import { Admin } from '../models/Admin';
import { signToken } from '../utils/jwt';
import { AppError } from '../utils/ApiError';
import { logger } from '../utils/logger';

export interface AdminCredentials {
  username: string;
  password: string;
}

export async function loginAdmin(credentials: AdminCredentials) {
  const admin = await Admin.findOne({ username: credentials.username, isActive: true });
  if (!admin) {
    logger.warn('Login attempt with unknown admin', { username: credentials.username });
    throw new AppError('Invalid credentials', 401, 'AUTH_INVALID');
  }

  const valid = await bcrypt.compare(credentials.password, admin.passwordHash);
  if (!valid) {
    logger.warn('Login failed for admin', { username: credentials.username });
    throw new AppError('Invalid credentials', 401, 'AUTH_INVALID');
  }

  admin.lastLoginAt = new Date();
  await admin.save();

  const token = signToken({
    sub: String(admin._id),
    username: admin.username,
    role: 'admin',
  });

  logger.info('Admin login', { adminId: String(admin._id), adminUsername: admin.username });

  return {
    token,
    admin: {
      id: String(admin._id),
      username: admin.username,
      name: admin.name,
    },
  };
}

export async function getAdminById(id: string) {
  const admin = await Admin.findById(id).lean();
  if (!admin) return null;
  return {
    id: String(admin._id),
    username: admin.username,
    name: admin.name,
  };
}
