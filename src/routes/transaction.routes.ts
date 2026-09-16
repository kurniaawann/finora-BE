import { Router } from 'express';

import {
  createTransactionController,
  getTransactionsController,
  getTransactionController,
  updateTransactionController,
  deleteTransactionController,
} from '../controllers/transaction.controller.js';

import {
  createTransactionSchema,
  updateTransactionSchema,
} from '../validators/transaction.validator.js';

import { validate } from '../middlewares/validation.middleware.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';

const router = Router();

router.use(authMiddleware);

router.post(
  '/',
  validate(createTransactionSchema),
  createTransactionController,
);

router.get(
  '/',
  getTransactionsController,
);

router.get(
  '/:id',
  getTransactionController,
);

router.put(
  '/:id',
  validate(updateTransactionSchema),
  updateTransactionController,
);

router.delete(
  '/:id',
  deleteTransactionController,
);

export default router;