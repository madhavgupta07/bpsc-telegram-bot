import { Router } from 'express';

import {
  listTopics,
  getTopicTree,
  getTopic,
  createTopic,
  updateTopic,
  deleteTopic,
} from '../controllers/topics.controller';
import { requireAuth } from '../middleware/auth';
import { apiLimiter } from '../middleware/rateLimiter';
import { validate } from '../middleware/validate';
import { idParamSchema, createTopicSchema, updateTopicSchema } from '../validators/schemas';

const router = Router();

router.use(requireAuth, apiLimiter);

router.get('/', listTopics);
router.get('/tree', getTopicTree);
router.get('/:id', validate(idParamSchema), getTopic);
router.post('/', validate(createTopicSchema), createTopic);
router.patch('/:id', validate(idParamSchema), validate(updateTopicSchema), updateTopic);
router.delete('/:id', validate(idParamSchema), deleteTopic);

export default router;
