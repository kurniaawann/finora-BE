import { Router } from 'express';

import {
  createTransferController,
  deleteTransferController,
  getTransferController,
  getTransfersController,
  updateTransferController,
} from '../controllers/transfer.controller.js';

import {
  createTransferSchema,
  updateTransferSchema,
} from '../validators/transfer.validator.js';
import { validate } from '../middlewares/validation.middleware.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';

const router = Router();

router.use(authMiddleware);

router.post(
  '/',
  validate(createTransferSchema),
  createTransferController,
);

router.get(
  '/',
  getTransfersController,
);

router.get(
  '/:id',
  getTransferController,
);

router.put(
  '/:id',
  validate(updateTransferSchema),
  updateTransferController,
);

router.delete(
  '/:id',
  deleteTransferController,
);
export default router;