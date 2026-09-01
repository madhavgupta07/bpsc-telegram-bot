import type { Request, Response } from 'express';

import { env } from '../config/env';
import { telegramBotHandler } from '../services/telegramBot.service';
import { logger } from '../utils/logger';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError, UnauthorizedError } from '../utils/ApiError';

const HEADER = 'x-telegram-bot-api-secret-token';

export const webhook = asyncHandler(async (req: Request, res: Response) => {
  if (!env.telegramWebhookSecret) {
    logger.warn('TELEGRAM_WEBHOOK_SECRET not set; accepting webhook without verification (dev mode).');
  } else {
    const provided = req.headers[HEADER];
    if (provided !== env.telegramWebhookSecret) {
      throw new UnauthorizedError('Invalid webhook secret', 'AUTH_INVALID');
    }
  }

  const update = req.body;
  if (!update || typeof update.update_id !== 'number') {
    throw new AppError('Invalid Telegram update payload', 400, 'BAD_REQUEST');
  }

  await telegramBotHandler.handleUpdate(update);

  res.status(200).json({ success: true, message: 'OK' });
});

export const sendTest = asyncHandler(async (_req: Request, res: Response) => {
  void logger;
  res.json({ success: true, message: 'Telegram webhook endpoint ready' });
});
