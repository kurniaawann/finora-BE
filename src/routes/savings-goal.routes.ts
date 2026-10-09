import { Router } from 'express';

import {
  addContributionController,
  cancelContributionController,
  confirmContributionController,
  createSavingsGoalController,
  deleteContributionController,
  deleteSavingsGoalController,
  getContributionController,
  getSavingsGoalController,
  joinSavingsGoalController,
  listContributionsController,
  listSavingsGoalsController,
  regenerateShareTokenController,
  rejectContributionController,
  removeContributionProofController,
  updateContributionController,
  updateSavingsGoalController,
  uploadContributionProofController,
} from '../controllers/savings-goal.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { uploadPhoto } from '../middlewares/upload.middleware.js';
import { validate } from '../middlewares/validation.middleware.js';
import {
  addSavingsContributionSchema,
  createSavingsGoalSchema,
  joinSavingsGoalSchema,
  updateSavingsContributionSchema,
  updateSavingsGoalSchema,
} from '../validators/savings-goal.validator.js';

const router = Router();

router.use(authMiddleware);

router.get('/', listSavingsGoalsController);
router.post('/', validate(createSavingsGoalSchema), createSavingsGoalController);
router.post('/join', validate(joinSavingsGoalSchema), joinSavingsGoalController);

router.get('/contributions/:contributionId', getContributionController);
router.put(
  '/contributions/:contributionId',
  validate(updateSavingsContributionSchema),
  updateContributionController,
);
router.delete('/contributions/:contributionId', deleteContributionController);
router.put(
  '/contributions/:contributionId/proof',
  uploadPhoto,
  uploadContributionProofController,
);
router.delete(
  '/contributions/:contributionId/proof',
  removeContributionProofController,
);
router.post(
  '/contributions/:contributionId/confirm',
  confirmContributionController,
);
router.post(
  '/contributions/:contributionId/reject',
  rejectContributionController,
);
router.post(
  '/contributions/:contributionId/cancel',
  cancelContributionController,
);

router.get('/:id', getSavingsGoalController);
router.put('/:id', validate(updateSavingsGoalSchema), updateSavingsGoalController);
router.delete('/:id', deleteSavingsGoalController);
router.post('/:id/share-token', regenerateShareTokenController);
router.get('/:id/contributions', listContributionsController);
router.post(
  '/:id/contributions',
  validate(addSavingsContributionSchema),
  addContributionController,
);

export default router;
