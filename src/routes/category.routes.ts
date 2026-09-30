import { Router } from 'express';

import {
  createCategoryController,
  deleteCategoryController,
  getCategoryController,
  listCategoriesController,
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

router.get('/', listCategoriesController);
router.post('/', validate(createCategorySchema), createCategoryController);
router.get('/:id', getCategoryController);
router.put('/:id', validate(updateCategorySchema), updateCategoryController);
router.delete('/:id', deleteCategoryController);

export default router;
