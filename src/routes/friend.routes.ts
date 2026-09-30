import { Router } from 'express';

import {
  acceptFriendRequestController,
  cancelFriendRequestController,
  listFriendRequestsController,
  listFriendsController,
  rejectFriendRequestController,
  searchUsersController,
  sendFriendRequestController,
  unfriendController,
} from '../controllers/friend.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validation.middleware.js';
import { sendFriendRequestSchema } from '../validators/friend.validator.js';

const router = Router();

router.use(authMiddleware);

router.get('/search', searchUsersController);

router.get('/requests', listFriendRequestsController);
router.post(
  '/requests',
  validate(sendFriendRequestSchema),
  sendFriendRequestController,
);
router.post('/requests/:id/accept', acceptFriendRequestController);
router.post('/requests/:id/reject', rejectFriendRequestController);
router.post('/requests/:id/cancel', cancelFriendRequestController);

router.get('/', listFriendsController);
router.delete('/:userId', unfriendController);

export default router;
