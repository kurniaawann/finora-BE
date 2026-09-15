import { Router } from 'express';

import {
  createAccountController,
  deleteAccountController,
  getAccountController,
  getAccountsController,
  updateAccountController,
} from '../controllers/account.controller.js';

import { authMiddleware } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validation.middleware.js';

import {
  createAccountSchema,
  updateAccountSchema,
} from '../validators/account.validator.js';

const router = Router();

router.use(authMiddleware);

router.post(
  '/',
  validate(createAccountSchema),
  createAccountController,
);

router.get(
  '/',
  getAccountsController,
);

router.get(
  '/:id',
  getAccountController,
);

router.put(
  '/:id',
  validate(updateAccountSchema),
  updateAccountController,
);

router.delete(
  '/:id',
  deleteAccountController,
);

export default router;