import { createApp } from './app';
import { env, isProduction } from './config/env';
import { connectDatabase } from './config/database';
import { logger } from './utils/logger';
import { seedTopics } from './utils/topicSeed';
import { seedAdmin } from './utils/adminSeed';
import { startScheduler } from './jobs/scheduler';

async function bootstrap(): Promise<void> {
  await connectDatabase();

  await seedAdmin();
  await seedTopics();

  const app = createApp();

  app.listen(env.port, () => {
    logger.info(
      `Server running on port ${env.port} in ${env.nodeEnv} mode (http://localhost:${env.port})`
    );
    logger.info(`Client URL: ${env.clientUrl}`);
    logger.info(`Cron timezone: ${env.cronTimezone}`);
  });

  startScheduler();
}

bootstrap().catch((error) => {
  logger.error('Failed to start server', error);
  process.exit(1);
});

process.on('unhandledRejection', (error) => {
  logger.error('Unhandled promise rejection', error instanceof Error ? error : undefined);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', error);
  if (isProduction) {
    process.exit(1);
  }
});
