import { Router } from 'express';

import {
  createCategoryController,
  deleteCategoryController,
  getCategoriesController,
  getCategoryController,
  updateCategoryController,
} from '../controllers/category.controller.js';

import { authMiddleware } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validation.middleware.js';

import {
  createCategorySchema,
  updateCategorySchema,
} from '../validators/category.validator.js';

const router = Router();

router.use(authMiddleware);

router.post(
  '/',
  validate(createCategorySchema),
  createCategoryController,
);

router.get(
  '/',
  getCategoriesController,
);

router.get(
  '/:id',
  getCategoryController,
);

router.put(
  '/:id',
  validate(updateCategorySchema),
  updateCategoryController,
);

router.delete(
  '/:id',
  deleteCategoryController,
);

export default router;