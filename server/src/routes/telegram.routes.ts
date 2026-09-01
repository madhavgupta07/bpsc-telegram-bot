import { Router } from 'express';

import { webhook, sendTest } from '../controllers/telegram.controller';
import { telegramWebhookLimiter } from '../middleware/rateLimiter';
import { requireAuth } from '../middleware/auth';
import { apiLimiter } from '../middleware/rateLimiter';

const router = Router();

router.post('/webhook', telegramWebhookLimiter, webhook);
router.get('/test', requireAuth, apiLimiter, sendTest);

export default router;
