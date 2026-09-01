import bcrypt from 'bcryptjs';

import { Admin } from '../models/Admin';
import { logger } from '../utils/logger';
import { env } from '../config/env';

export async function seedAdmin(): Promise<void> {
  const existing = await Admin.countDocuments().lean();

  if (existing === 0) {
    if (!env.adminPassword) {
      logger.warn(
        'No admin account exists and ADMIN_PASSWORD is not set. Create an admin via env ADMIN_USERNAME/ADMIN_PASSWORD or register manually.'
      );
      return;
    }

    const passwordHash = await bcrypt.hash(env.adminPassword, 10);
    await Admin.create({
      username: env.adminUsername,
      passwordHash,
      name: 'Administrator',
      isActive: true,
    });
    logger.info(`Default admin created: ${env.adminUsername}`);
  }
}
