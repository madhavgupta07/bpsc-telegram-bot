import { Router } from 'express';

import {
  getDashboardStats,
  getUserStats,
  getTopUsers,
  getLeaderboard,
} from '../controllers/statistics.controller';
import { getDailyParticipation, getTopicPerformance, getQuestionPerformance, getRangeStats } from '../controllers/analytics.controller';
import { requireAuth } from '../middleware/auth';
import { apiLimiter } from '../middleware/rateLimiter';
import { validate } from '../middleware/validate';
import { idParamSchema } from '../validators/schemas';

const router = Router();

router.use(requireAuth, apiLimiter);

router.get('/dashboard', getDashboardStats);
router.get('/leaderboard', getLeaderboard);
router.get('/top-users', getTopUsers);
router.get('/analytics/participation', getDailyParticipation);
router.get('/analytics/topics', getTopicPerformance);
router.get('/analytics/questions', getQuestionPerformance);
router.get('/analytics/range', getRangeStats);
router.get('/users/:id', validate(idParamSchema), getUserStats);

export default router;
