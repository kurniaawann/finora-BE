import { Router } from 'express';

import {
  cancelFriendRequestController,
  getFriendRequestsController,
  getFriendsController,
  respondFriendRequestController,
  searchUsersController,
  sendFriendRequestController,
  unfriendController,
} from '../controllers/friend.controller.js';

import { authMiddleware } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validation.middleware.js';

import {
  respondFriendRequestSchema,
  sendFriendRequestSchema,
} from '../validators/friend.validator.js';

const router = Router();

router.use(authMiddleware);

router.get(
  '/search',
  searchUsersController,
);

router.post(
  '/requests',
  validate(sendFriendRequestSchema),
  sendFriendRequestController,
);

router.get(
  '/requests',
  getFriendRequestsController,
);

router.patch(
  '/requests/:id',
  validate(respondFriendRequestSchema),
  respondFriendRequestController,
);

router.delete(
  '/requests/:id',
  cancelFriendRequestController,
);

router.get(
  '/',
  getFriendsController,
);

router.delete(
  '/:friendId',
  unfriendController,
);

export default router;