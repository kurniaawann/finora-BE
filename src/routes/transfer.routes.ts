import { Router } from 'express';

import {
  createTransferController,
  deleteTransferController,
  getTransferController,
  listTransfersController,
  updateTransferController,
} from '../controllers/transfer.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validation.middleware.js';
import {
  createTransferSchema,
  updateTransferSchema,
} from '../validators/transfer.validator.js';

const router = Router();

router.use(authMiddleware);

router.get('/', listTransfersController);
router.post('/', validate(createTransferSchema), createTransferController);
router.get('/:id', getTransferController);
router.put('/:id', validate(updateTransferSchema), updateTransferController);
router.delete('/:id', deleteTransferController);

export default router;
