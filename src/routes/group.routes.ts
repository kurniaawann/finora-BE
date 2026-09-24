import { Router } from 'express';

import {
  addGroupMemberController,
  createGroupController,
  deleteGroupController,
  getGroupController,
  getGroupsController,
  joinGroupController,
  removeGroupMemberController,
  updateGroupController,
  updateGroupMemberController,
} from '../controllers/group.controller.js';

import expenseRoutes from './expense.routes.js';
import settlementRoutes from './settlement.routes.js';
import eventRoutes from './event.routes.js';

import { authMiddleware } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validation.middleware.js';

import {
  addGroupMemberSchema,
  createGroupSchema,
  joinGroupSchema,
  updateGroupMemberSchema,
  updateGroupSchema,
} from '../validators/group.validator.js';

const router = Router();

router.use(authMiddleware);

router.use('/:groupId/expenses', expenseRoutes);
router.use('/:groupId/settlements', settlementRoutes);
router.use('/:groupId/events', eventRoutes);

router.post(
  '/join',
  validate(joinGroupSchema),
  joinGroupController,
);

router.post(
  '/',
  validate(createGroupSchema),
  createGroupController,
);

router.get('/', getGroupsController);

router.get('/:id', getGroupController);

router.put(
  '/:id',
  validate(updateGroupSchema),
  updateGroupController,
);

router.delete('/:id', deleteGroupController);

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

router.delete(
  '/:id/members/:userId',
  removeGroupMemberController,
);

export default router;