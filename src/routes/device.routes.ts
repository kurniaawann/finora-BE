import { Router } from 'express';

import {
  registerDeviceController,
  removeDeviceController,
} from '../controllers/device.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validation.middleware.js';
import {
  registerDeviceSchema,
  removeDeviceSchema,
} from '../validators/device.validator.js';

const router = Router();

router.use(authMiddleware);

router.post('/', validate(registerDeviceSchema), registerDeviceController);
router.delete('/', validate(removeDeviceSchema), removeDeviceController);

export default router;
