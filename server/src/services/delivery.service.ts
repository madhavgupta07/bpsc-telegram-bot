import { User } from '../models/User';
import { logger } from '../utils/logger';
import { telegramService } from './telegram.service';
import { findActiveQuizForDate } from './quiz.service';
import { getDateKey } from '../utils/date';
import { telegramBotHandler } from './telegramBot.service';

export interface DeliveryResult {
  attempted: number;
  delivered: number;
  failed: number;
}

export async function deliverQuizzesForToday(): Promise<DeliveryResult> {
  const today = getDateKey();
  const quiz = await findActiveQuizForDate(today);

  if (!quiz) {
    logger.warn(`[Delivery] No active quiz found for ${today}; skipping delivery.`);
    return { attempted: 0, delivered: 0, failed: 0 };
  }

  const users = await User.find({ isActive: true, isSubscribed: true }).lean();
  const total = users.length;
  logger.info(`[Delivery] Found ${total} subscribed users for today's quiz ${quiz.date}`);

  let delivered = 0;
  let failed = 0;

  for (const user of users) {
    try {
      await telegramBotHandler.deliverQuiz(user.telegramId);
      delivered += 1;
    } catch (error) {
      failed += 1;
      logger.error(
        `[Delivery] Failed to deliver quiz to user ${user.telegramId}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  logger.info(
    `[Delivery] Completed. attempted=${total}, delivered=${delivered}, failed=${failed}`
  );

  return { attempted: total, delivered, failed };
}

export async function notifyQuizAvailable(chatId: number): Promise<void> {
  const today = getDateKey();
  const quiz = await findActiveQuizForDate(today);
  if (!quiz) return;

  try {
    await telegramService.sendMessage(
      chatId,
      `📚 Today's Bihar STET Daily Quiz is ready!\n\n` +
        `Use /quiz to start it now.`
    );
  } catch (error) {
    logger.error(`Failed to notify user ${chatId} about today's quiz`, error);
  }
}
