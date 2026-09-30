import { Router } from 'express';

import {
  createRecurringTransactionController,
  deleteRecurringTransactionController,
  getRecurringTransactionController,
  listRecurringTransactionsController,
  runRecurringTransactionController,
  updateRecurringTransactionController,
} from '../controllers/recurring-transaction.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validation.middleware.js';
import {
  createRecurringTransactionSchema,
  updateRecurringTransactionSchema,
} from '../validators/recurring-transaction.validator.js';

const router = Router();

router.use(authMiddleware);

router.get('/', listRecurringTransactionsController);
router.post(
  '/',
  validate(createRecurringTransactionSchema),
  createRecurringTransactionController,
);
router.get('/:id', getRecurringTransactionController);
router.put(
  '/:id',
  validate(updateRecurringTransactionSchema),
  updateRecurringTransactionController,
);
router.delete('/:id', deleteRecurringTransactionController);
router.post('/:id/run', runRecurringTransactionController);

export default router;
