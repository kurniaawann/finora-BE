import { Router } from 'express';

import {
  activateExpenseController,
  cancelExpenseController,
  cancelPaymentController,
  confirmPaymentController,
  createExpenseController,
  createPaymentController,
  deleteExpenseController,
  getExpenseController,
  getPaymentController,
  listGroupExpensesController,
  listPaymentsController,
  rejectPaymentController,
  removeExpenseReceiptController,
  removePaymentProofController,
  updateExpenseController,
  updateExpenseReceiptController,
  updatePaymentProofController,
} from '../controllers/expense.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { uploadPhoto } from '../middlewares/upload.middleware.js';
import { validate } from '../middlewares/validation.middleware.js';
import {
  createExpensePaymentSchema,
  createExpenseSchema,
  updateExpenseSchema,
} from '../validators/expense.validator.js';

/** Dipasang di /groups/:groupId/expenses (auth dari router grup). */
export const groupExpenseRoutes = Router({ mergeParams: true });

groupExpenseRoutes.get('/', listGroupExpensesController);
groupExpenseRoutes.post(
  '/',
  validate(createExpenseSchema),
  createExpenseController,
);

const router = Router();

router.use(authMiddleware);

// Pembayaran tagihan (statis, sebelum /:id)
router.get('/payments/:paymentId', getPaymentController);
router.post('/payments/:paymentId/confirm', confirmPaymentController);
router.post('/payments/:paymentId/reject', rejectPaymentController);
router.post('/payments/:paymentId/cancel', cancelPaymentController);
router.put('/payments/:paymentId/proof', uploadPhoto, updatePaymentProofController);
router.delete('/payments/:paymentId/proof', removePaymentProofController);

// Pengeluaran
router.get('/:id', getExpenseController);
router.put('/:id', validate(updateExpenseSchema), updateExpenseController);
router.delete('/:id', deleteExpenseController);
router.post('/:id/activate', activateExpenseController);
router.post('/:id/cancel', cancelExpenseController);
router.put('/:id/receipt', uploadPhoto, updateExpenseReceiptController);
router.delete('/:id/receipt', removeExpenseReceiptController);
router.get('/:id/payments', listPaymentsController);
router.post(
  '/:id/payments',
  validate(createExpensePaymentSchema),
  createPaymentController,
);

export default router;
