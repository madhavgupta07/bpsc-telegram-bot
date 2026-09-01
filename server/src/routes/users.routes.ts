import { Router } from 'express';

import {
  listUsers,
  getUserDetail,
  toggleUserActive,
  toggleUserSubscription,
} from '../controllers/users.controller';
import { requireAuth } from '../middleware/auth';
import { apiLimiter } from '../middleware/rateLimiter';
import { validate } from '../middleware/validate';
import { idParamSchema } from '../validators/schemas';

const router = Router();

router.use(requireAuth, apiLimiter);

router.get('/', listUsers);
router.get('/:id', validate(idParamSchema), getUserDetail);
router.patch('/:id/active', validate(idParamSchema), toggleUserActive);
router.patch('/:id/subscription', validate(idParamSchema), toggleUserSubscription);

export default router;
