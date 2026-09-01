import { Router } from 'express';

import {
  listQuizzes,
  getQuiz,
  generateQuiz,
  regenerateQuiz,
  previewQuiz,
  publishQuiz,
  unpublishQuiz,
  replaceQuestion,
  getTodaysQuiz,
  startQuiz,
  getTomorrowQuizStatus,
} from '../controllers/quizzes.controller';
import { requireAuth } from '../middleware/auth';
import { apiLimiter, aiGenerationLimiter } from '../middleware/rateLimiter';
import { validate } from '../middleware/validate';
import {
  quizParamsSchema,
  generateQuizSchema,
} from '../validators/schemas';

const router = Router();

router.use(requireAuth, apiLimiter);

router.get('/', listQuizzes);
router.get('/today', getTodaysQuiz);
router.get('/tomorrow', getTomorrowQuizStatus);
router.get('/:date', validate(quizParamsSchema), getQuiz);
router.get('/:date/preview', validate(quizParamsSchema), previewQuiz);
router.post('/generate', aiGenerationLimiter, validate(generateQuizSchema), generateQuiz);
router.post('/:date/regenerate', validate(quizParamsSchema), regenerateQuiz);
router.patch('/:date/publish', validate(quizParamsSchema), publishQuiz);
router.patch('/:date/unpublish', validate(quizParamsSchema), unpublishQuiz);
router.post('/:date/start', validate(quizParamsSchema), startQuiz);
router.post('/:date/replace-question', validate(quizParamsSchema), replaceQuestion);

export default router;
