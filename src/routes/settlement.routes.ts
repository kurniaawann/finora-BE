import { Router } from 'express';

import {
  cancelSettlementController,
  confirmSettlementController,
  createSettlementController,
  deleteSettlementController,
  getSettlementController,
  listGroupSettlementsController,
  rejectSettlementController,
  removeSettlementProofController,
  updateSettlementController,
  updateSettlementProofController,
} from '../controllers/settlement.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { uploadPhoto } from '../middlewares/upload.middleware.js';
import { validate } from '../middlewares/validation.middleware.js';
import {
  confirmSettlementSchema,
  createSettlementSchema,
  updateSettlementSchema,
} from '../validators/settlement.validator.js';

/** Dipasang di /groups/:groupId/settlements (auth dari router grup). */
export const groupSettlementRoutes = Router({ mergeParams: true });

groupSettlementRoutes.get('/', listGroupSettlementsController);
groupSettlementRoutes.post(
  '/',
  validate(createSettlementSchema),
  createSettlementController,
);

const router = Router();

router.use(authMiddleware);

router.get('/:id', getSettlementController);
router.put('/:id', validate(updateSettlementSchema), updateSettlementController);
router.delete('/:id', deleteSettlementController);
router.post(
  '/:id/confirm',
  validate(confirmSettlementSchema),
  confirmSettlementController,
);
router.post('/:id/reject', rejectSettlementController);
router.post('/:id/cancel', cancelSettlementController);
router.put('/:id/proof', uploadPhoto, updateSettlementProofController);
router.delete('/:id/proof', removeSettlementProofController);

export default router;
