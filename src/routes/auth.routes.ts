import { Router } from 'express';

import {
  loginController,
  logoutController,
  meController,
  refreshController,
  registerController,
} from '../controllers/auth.controller.js';

import { authMiddleware } from '../middlewares/auth.middleware.js';

const router = Router();

router.post('/register', registerController);

router.post('/login', loginController);

router.get(
  '/me',
  authMiddleware,
  meController,
);

router.post(
  '/refresh',
  refreshController,
);
router.post(
  '/logout',
  logoutController,
);

export default router;