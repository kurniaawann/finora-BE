import type { Request, Response } from 'express';

import { toCategoryDTO } from '../dtos/category.dto.js';
import {
  createCategory,
  deleteCategory,
  getCategory,
  listCategories,
  updateCategory,
} from '../services/category.service.js';
import { getAuthenticatedUserId, getParam } from '../utils/auth.js';
import {
  parseBooleanFilter,
  parseEnumFilter,
  parseIdFilter,
  parseSearchQuery,
} from '../utils/filters.js';
import { buildPaginationMeta, parsePagination } from '../utils/pagination.js';
import { success } from '../utils/response.js';
import { CATEGORY_TYPES } from '../validators/category.validator.js';

export const listCategoriesController = async (
  req: Request,
  res: Response,
) => {
  const pagination = parsePagination(req.query);

  // `root=true` → hanya kategori level atas; `parent_id` → sub-kategorinya.
  const parentId = parseBooleanFilter(req.query, 'root')
    ? null
    : parseIdFilter(req.query, 'parent_id');

  const result = await listCategories(getAuthenticatedUserId(req), pagination, {
    type: parseEnumFilter(req.query, 'type', CATEGORY_TYPES),
    parentId,
    search: parseSearchQuery(req.query),
  });

  return success(res, 200, 'Daftar kategori berhasil diambil', {
    data: result.data.map(toCategoryDTO),
    pagination: buildPaginationMeta(pagination, result.total),
  });
};

export const getCategoryController = async (req: Request, res: Response) => {
  const category = await getCategory(
    getAuthenticatedUserId(req),
    getParam(req, 'id'),
  );

  return success(res, 200, 'Kategori berhasil diambil', {
    data: toCategoryDTO(category),
  });
};

export const createCategoryController = async (
  req: Request,
  res: Response,
) => {
  const category = await createCategory(getAuthenticatedUserId(req), req.body);

  return success(res, 201, 'Kategori berhasil dibuat', {
    data: toCategoryDTO(category),
  });
};

export const updateCategoryController = async (
  req: Request,
  res: Response,
) => {
  const category = await updateCategory(
    getAuthenticatedUserId(req),
    getParam(req, 'id'),
    req.body,
  );

  return success(res, 200, 'Kategori berhasil diperbarui', {
    data: toCategoryDTO(category),
  });
};

export const deleteCategoryController = async (
  req: Request,
  res: Response,
) => {
  await deleteCategory(getAuthenticatedUserId(req), getParam(req, 'id'));

  return success(res, 200, 'Kategori berhasil dihapus');
};
