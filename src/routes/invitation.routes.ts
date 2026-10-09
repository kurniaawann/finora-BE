import { Router } from 'express';

import {
  acceptInvitationController,
  cancelInvitationController,
  createGroupInvitationController,
  getInvitationController,
  listGroupInvitationsController,
  listMyInvitationsController,
  rejectInvitationController,
} from '../controllers/invitation.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validation.middleware.js';
import { createInvitationSchema } from '../validators/invitation.validator.js';

/** Dipasang di /groups/:groupId/invitations (auth dari router grup). */
export const groupInvitationRoutes = Router({ mergeParams: true });

groupInvitationRoutes.get('/', listGroupInvitationsController);
groupInvitationRoutes.post(
  '/',
  validate(createInvitationSchema),
  createGroupInvitationController,
);

const router = Router();

router.use(authMiddleware);

router.get('/', listMyInvitationsController);
router.get('/:id', getInvitationController);
router.post('/:id/accept', acceptInvitationController);
router.post('/:id/reject', rejectInvitationController);
router.post('/:id/cancel', cancelInvitationController);

export default router;
