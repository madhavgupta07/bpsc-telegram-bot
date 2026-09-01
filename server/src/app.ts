import express, { type Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import mongoSanitize from 'express-mongo-sanitize';

import { env } from './config/env';
import authRoutes from './routes/auth.routes';
import userRoutes from './routes/users.routes';
import questionRoutes from './routes/questions.routes';
import topicRoutes from './routes/topics.routes';
import quizRoutes from './routes/quizzes.routes';
import statisticsRoutes from './routes/statistics.routes';
import telegramRoutes from './routes/telegram.routes';
import { apiLimiter } from './middleware/rateLimiter';
import { notFoundHandler, errorHandler } from './middleware/errorHandler';

export function createApp(): Application {
  const app = express();

  // Trust first proxy (Render, Heroku, etc.) so rate-limiter reads X-Forwarded-For correctly
  app.set('trust proxy', 1);

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    })
  );

  app.use(
    cors({
      origin: env.clientUrl,
      credentials: true,
    })
  );

  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  app.use(mongoSanitize());

  app.get('/api/health', (_req, res) => {
    res.json({ success: true, status: 'ok', timestamp: new Date().toISOString() });
  });

  app.use('/api/auth', apiLimiter, authRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/questions', questionRoutes);
  app.use('/api/topics', topicRoutes);
  app.use('/api/quizzes', quizRoutes);
  app.use('/api/statistics', statisticsRoutes);
  app.use('/api/telegram', telegramRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
