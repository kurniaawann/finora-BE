import { Router } from 'express';

import {
  createPaymentMethodController,
  deletePaymentMethodController,
  getPaymentMethodController,
  getPaymentMethodsController,
  updatePaymentMethodController,
} from '../controllers/payment-method.controller.js';

import { authMiddleware } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validation.middleware.js';

import {
  createPaymentMethodSchema,
  updatePaymentMethodSchema,
} from '../validators/payment-method.validator.js';

const router = Router();

router.use(authMiddleware);

router.post(
  '/',
  validate(createPaymentMethodSchema),
  createPaymentMethodController,
);

router.get(
  '/',
  getPaymentMethodsController,
);

router.get(
  '/:id',
  getPaymentMethodController,
);

router.put(
  '/:id',
  validate(updatePaymentMethodSchema),
  updatePaymentMethodController,
);

router.delete(
  '/:id',
  deletePaymentMethodController,
);

export default router;