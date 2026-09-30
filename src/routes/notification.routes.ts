import { Router } from 'express';

import {
  deleteNotificationController,
  deleteReadNotificationsController,
  getUnreadCountController,
  listNotificationsController,
  markAllNotificationsReadController,
  markNotificationReadController,
} from '../controllers/notification.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';

const router = Router();

router.use(authMiddleware);

router.get('/', listNotificationsController);
router.delete('/', deleteReadNotificationsController);
router.get('/unread-count', getUnreadCountController);
router.patch('/read-all', markAllNotificationsReadController);

router.patch('/:id/read', markNotificationReadController);
router.delete('/:id', deleteNotificationController);

export default router;
