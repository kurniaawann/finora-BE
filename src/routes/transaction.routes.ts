import { Router } from 'express';

import {
  createTransactionController,
  deleteTransactionController,
  getTransactionController,
  getTransactionSummaryController,
  listTransactionsController,
  removeTransactionReceiptController,
  updateTransactionController,
  updateTransactionReceiptController,
} from '../controllers/transaction.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { uploadPhoto } from '../middlewares/upload.middleware.js';
import { validate } from '../middlewares/validation.middleware.js';
import {
  createTransactionSchema,
  updateTransactionSchema,
} from '../validators/transaction.validator.js';

const router = Router();

router.use(authMiddleware);

router.get('/', listTransactionsController);
router.post(
  '/',
  validate(createTransactionSchema),
  createTransactionController,
);
router.get('/summary', getTransactionSummaryController);
router.get('/:id', getTransactionController);
router.put(
  '/:id',
  validate(updateTransactionSchema),
  updateTransactionController,
);
router.delete('/:id', deleteTransactionController);
router.put('/:id/receipt', uploadPhoto, updateTransactionReceiptController);
router.delete('/:id/receipt', removeTransactionReceiptController);

export default router;
