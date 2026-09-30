import { Router } from 'express';

import {
  addGroupMemberController,
  createGroupController,
  deleteGroupController,
  getGroupBalancesController,
  getGroupController,
  joinGroupController,
  leaveGroupController,
  listGroupsController,
  previewJoinGroupController,
  regenerateInviteCodeController,
  removeGroupAvatarController,
  removeGroupMemberController,
  transferOwnershipController,
  updateGroupAvatarController,
  updateGroupController,
  updateGroupMemberController,
} from '../controllers/group.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { uploadPhoto } from '../middlewares/upload.middleware.js';
import { validate } from '../middlewares/validation.middleware.js';
import {
  addGroupMemberSchema,
  createGroupSchema,
  joinGroupSchema,
  transferOwnershipSchema,
  updateGroupMemberSchema,
  updateGroupSchema,
} from '../validators/group.validator.js';
import { groupEventRoutes } from './event.routes.js';
import { groupExpenseRoutes } from './expense.routes.js';
import { groupInvitationRoutes } from './invitation.routes.js';
import { groupSettlementRoutes } from './settlement.routes.js';

const router = Router();

// Router bersarang di bawah ini ikut terlindungi middleware auth ini.
router.use(authMiddleware);

router.use('/:groupId/expenses', groupExpenseRoutes);
router.use('/:groupId/settlements', groupSettlementRoutes);
router.use('/:groupId/events', groupEventRoutes);
router.use('/:groupId/invitations', groupInvitationRoutes);

router.get('/', listGroupsController);
router.post('/', validate(createGroupSchema), createGroupController);

router.get('/join/:inviteCode', previewJoinGroupController);
router.post('/join', validate(joinGroupSchema), joinGroupController);

router.get('/:id', getGroupController);
router.put('/:id', validate(updateGroupSchema), updateGroupController);
router.delete('/:id', deleteGroupController);

router.put('/:id/avatar', uploadPhoto, updateGroupAvatarController);
router.delete('/:id/avatar', removeGroupAvatarController);

router.post('/:id/invite-code', regenerateInviteCodeController);
router.get('/:id/balances', getGroupBalancesController);

router.post(
  '/:id/members',
  validate(addGroupMemberSchema),
  addGroupMemberController,
);
router.put(
  '/:id/members/:userId',
  validate(updateGroupMemberSchema),
  updateGroupMemberController,
);
router.delete('/:id/members/:userId', removeGroupMemberController);

router.post(
  '/:id/transfer-ownership',
  validate(transferOwnershipSchema),
  transferOwnershipController,
);
router.post('/:id/leave', leaveGroupController);

export default router;
