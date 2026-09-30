import { Router } from 'express';

import {
  getProfileController,
  removeAvatarController,
  updateAvatarController,
  updateProfileController,
} from '../controllers/profile.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { uploadPhoto } from '../middlewares/upload.middleware.js';
import { validate } from '../middlewares/validation.middleware.js';
import { updateProfileSchema } from '../validators/profile.validator.js';

const router = Router();

router.use(authMiddleware);

router.get('/', getProfileController);
router.put('/', validate(updateProfileSchema), updateProfileController);
router.put('/avatar', uploadPhoto, updateAvatarController);
router.delete('/avatar', removeAvatarController);

export default router;
