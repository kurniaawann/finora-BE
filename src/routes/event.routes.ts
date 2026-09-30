import { Router } from 'express';

import {
  addEventMembersController,
  createGroupEventController,
  deleteEventController,
  getEventController,
  listGroupEventsController,
  removeEventMemberController,
  updateEventController,
} from '../controllers/event.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validation.middleware.js';
import {
  addEventMembersSchema,
  createEventSchema,
  updateEventSchema,
} from '../validators/event.validator.js';

/** Dipasang di /groups/:groupId/events (auth dari router grup). */
export const groupEventRoutes = Router({ mergeParams: true });

groupEventRoutes.get('/', listGroupEventsController);
groupEventRoutes.post(
  '/',
  validate(createEventSchema),
  createGroupEventController,
);

const router = Router();

router.use(authMiddleware);

router.get('/:id', getEventController);
router.put('/:id', validate(updateEventSchema), updateEventController);
router.delete('/:id', deleteEventController);
router.post(
  '/:id/members',
  validate(addEventMembersSchema),
  addEventMembersController,
);
router.delete('/:id/members/:userId', removeEventMemberController);

export default router;
