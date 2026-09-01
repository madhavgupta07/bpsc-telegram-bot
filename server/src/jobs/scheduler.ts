import cron from 'node-cron';

import { env } from '../config/env';
import { QUIZ_DELIVERY_CRON, QUIZ_GENERATION_CRON, TIMEZONE } from '../config/constants';
import { logger } from '../utils/logger';
import { generateQuizForDate } from '../services/generation.service';
import { addDaysToDateKey, getDateKey } from '../utils/date';
import { deliverQuizzesForToday } from '../services/delivery.service';

const jobStore = new Map<string, { stop: () => void }>();

function scheduleJob(name: string, cronExpr: string, fn: () => Promise<void>): void {
  const task = cron.schedule(
    cronExpr,
    async () => {
      logger.info(`[Scheduler] Running job: ${name}`);
      try {
        await fn();
        logger.info(`[Scheduler] Job completed: ${name}`);
      } catch (error) {
        logger.error(`[Scheduler] Job failed: ${name}`, error);
      }
    },
    { timezone: TIMEZONE }
  );
  jobStore.set(name, task);
  logger.info(`[Scheduler] Scheduled job '${name}' with cron '${cronExpr}' in timezone ${TIMEZONE}`);
}

export function startScheduler(): void {
  const tzConfirmed =
    (process.env.TZ = env.cronTimezone || TIMEZONE);

  void tzConfirmed;

  scheduleJob('generate-next-day-quiz', QUIZ_GENERATION_CRON, async () => {
    const tomorrow = addDaysToDateKey(getDateKey(), 1);
    logger.info(`Generating quiz for tomorrow: ${tomorrow}`);
    const { created } = await generateQuizForDate(tomorrow, {});
    logger.info(`Tomorrow's quiz generation ${created ? 'created' : 'already existed or unchanged'}`);
  });

  scheduleJob('deliver-daily-quiz', QUIZ_DELIVERY_CRON, async () => {
    await deliverQuizzesForToday();
  });

  logger.info(`[Scheduler] Started with timezone ${TIMEZONE}`);
}

export function stopScheduler(): void {
  for (const [, task] of jobStore) {
    task.stop();
  }
  jobStore.clear();
  logger.info('[Scheduler] Stopped all jobs');
}
