import { Router } from 'express';

import {
  changePasswordController,
  deleteAccountController,
  forgotPasswordController,
  loginController,
  logoutAllController,
  logoutController,
  meController,
  refreshController,
  registerController,
  resendVerificationController,
  resetPasswordController,
  verifyEmailController,
} from '../controllers/auth.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import {
  authRateLimiter,
  refreshRateLimiter,
} from '../middlewares/rateLimiter.middleware.js';
import { validate } from '../middlewares/validation.middleware.js';
import {
  changePasswordSchema,
  deleteAccountSchema,
  forgotPasswordSchema,
  loginSchema,
  refreshTokenSchema,
  registerSchema,
  resetPasswordSchema,
  verifyEmailSchema,
} from '../validators/auth.validator.js';

const router = Router();

router.post(
  '/register',
  authRateLimiter,
  validate(registerSchema),
  registerController,
);
router.post(
  '/login',
  authRateLimiter,
  validate(loginSchema),
  loginController,
);
router.post(
  '/refresh',
  refreshRateLimiter,
  validate(refreshTokenSchema),
  refreshController,
);
router.post(
  '/logout',
  validate(refreshTokenSchema),
  logoutController,
);

router.post(
  '/forgot-password',
  authRateLimiter,
  validate(forgotPasswordSchema),
  forgotPasswordController,
);
router.post(
  '/reset-password',
  authRateLimiter,
  validate(resetPasswordSchema),
  resetPasswordController,
);

router.get('/me', authMiddleware, meController);
router.post(
  '/email/verification',
  authMiddleware,
  authRateLimiter,
  resendVerificationController,
);
router.post(
  '/email/verify',
  authMiddleware,
  authRateLimiter,
  validate(verifyEmailSchema),
  verifyEmailController,
);
router.post('/logout-all', authMiddleware, logoutAllController);
router.put(
  '/password',
  authMiddleware,
  authRateLimiter,
  validate(changePasswordSchema),
  changePasswordController,
);
router.delete(
  '/account',
  authMiddleware,
  authRateLimiter,
  validate(deleteAccountSchema),
  deleteAccountController,
);

export default router;
