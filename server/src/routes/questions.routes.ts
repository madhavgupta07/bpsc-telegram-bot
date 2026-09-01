import { Router } from 'express';

import {
  listQuestions,
  getQuestion,
  createQuestion,
  updateQuestion,
  deleteQuestion,
  verifyQuestion,
} from '../controllers/questions.controller';
import { requireAuth } from '../middleware/auth';
import { apiLimiter, aiGenerationLimiter } from '../middleware/rateLimiter';
import { validate } from '../middleware/validate';
import {
  idParamSchema,
  createQuestionSchema,
  updateQuestionSchema,
  listQuestionsQuerySchema,
} from '../validators/schemas';

const router = Router();

router.use(requireAuth, apiLimiter);

router.get('/', validate(listQuestionsQuerySchema), listQuestions);
router.get('/:id', validate(idParamSchema), getQuestion);
router.post('/', aiGenerationLimiter, validate(createQuestionSchema), createQuestion);
router.patch('/:id', validate(updateQuestionSchema), updateQuestion);
router.delete('/:id', validate(idParamSchema), deleteQuestion);
router.patch('/:id/verify', validate(idParamSchema), verifyQuestion);

export default router;
