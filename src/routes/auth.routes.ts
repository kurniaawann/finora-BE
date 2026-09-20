import { Router } from 'express';

import {
  loginController,
  logoutController,
  meController,
  refreshController,
  registerController,
} from '../controllers/auth.controller.js';

import { authMiddleware } from '../middlewares/auth.middleware.js';
import { authRateLimiter } from '../middlewares/rateLimiter.middleware.js';
import { originCheck } from '../middlewares/origin.middleware.js';

const router = Router();

router.post('/register', authRateLimiter, registerController);

router.post('/login', authRateLimiter, loginController);

router.get(
  '/me',
  authMiddleware,
  meController,
);

router.post(
  '/refresh',
  authRateLimiter,
  originCheck,
  refreshController,
);
router.post(
  '/logout',
  originCheck,
  logoutController,
);

export default router;