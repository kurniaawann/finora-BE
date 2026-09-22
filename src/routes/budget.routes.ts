import { Router } from 'express';

import {
  createBudgetController,
  deleteBudgetController,
  getBudgetController,
  getBudgetsController,
  updateBudgetController,
} from '../controllers/budget.controller.js';

import { authMiddleware } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validation.middleware.js';

import {
  createBudgetSchema,
  updateBudgetSchema,
} from '../validators/budget.validator.js';

const router = Router();

router.use(authMiddleware);

router.post(
  '/',
  validate(createBudgetSchema),
  createBudgetController,
);

router.get(
  '/',
  getBudgetsController,
);

router.get(
  '/:id',
  getBudgetController,
);

router.put(
  '/:id',
  validate(updateBudgetSchema),
  updateBudgetController,
);

router.delete(
  '/:id',
  deleteBudgetController,
);

export default router;
