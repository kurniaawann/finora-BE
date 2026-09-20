import type { Request, Response } from 'express';

import {
  create,
  getAll,
  getById,
  remove,
  update,
} from '../services/category.service.js';

import { getAuthenticatedUserId } from '../utils/auth.js';
import {
  buildPaginationMeta,
  parsePagination,
} from '../utils/pagination.js';
import {
  parseEnumFilter,
  parseSearchQuery,
} from '../utils/filters.js';
import { toCategoryDTO } from '../dtos/category.dto.js';
import { fail, success } from '../utils/response.js';
import { logger } from '../config/logger.js';

const CATEGORIES_TYPES = ['income', 'expense'] as const;

const parseParentFilter = (
  req: Request,
): string | null | undefined => {
  if (req.query.root === 'true') {
    return null;
  }

  const raw = req.query.parent_id;

  if (typeof raw !== 'string' || raw.length === 0) {
    return undefined;
  }

  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  if (!uuidRegex.test(raw)) {
    throw new TypeError('INVALID_PARENT_FILTER');
  }

  return raw;
};

export const createCategoryController = async (
  req: Request,
  res: Response,
) => {
  try {
    const userId = getAuthenticatedUserId(req);

    const category = await create(userId, req.body);

    return success(
      res,
      201,
      'Kategori berhasil dibuat',
      { data: toCategoryDTO(category) },
    );
  } catch (error) {
    if (error instanceof Error) {
      switch (error.message) {
        case 'CATEGORY_NAME_EXISTS':
          return fail(
            res,
            409,
            'Nama kategori sudah digunakan',
          );

        case 'PARENT_CATEGORY_NOT_FOUND':
          return fail(
            res,
            404,
            'Kategori induk tidak ditemukan',
          );

        case 'INVALID_PARENT_CATEGORY_TYPE':
          return fail(
            res,
            422,
            'Tipe kategori induk tidak sesuai',
          );
      }
    }

    logger.error(error);

    return fail(
      res,
      500,
      'Gagal membuat kategori',
    );
  }
};

export const getCategoriesController = async (
  req: Request,
  res: Response,
) => {
  try {
    const userId = getAuthenticatedUserId(req);

    const { page, perPage } = parsePagination(
      req.query,
    );

    const type = parseEnumFilter(
      req.query,
      'type',
      CATEGORIES_TYPES,
    );
    const parentId = parseParentFilter(req);
    const search = parseSearchQuery(req.query);

    const result = await getAll(
      userId,
      page,
      perPage,
      type,
      parentId,
      search,
    );

    return success(
      res,
      200,
      'Data kategori berhasil diambil',
      {
        data: result.data.map(toCategoryDTO),
        pagination: buildPaginationMeta(
          { page, perPage },
          result.total,
        ),
      },
    );
  } catch (error) {
    if (
      error instanceof TypeError &&
      (error.message === 'INVALID_ENUM_FILTER' ||
        error.message === 'INVALID_PARENT_FILTER')
    ) {
      return fail(
        res,
        422,
        'Parameter filter tidak valid',
      );
    }

    logger.error(error);

    return fail(
      res,
      500,
      'Gagal mengambil kategori',
    );
  }
};

export const getCategoryController = async (
  req: Request,
  res: Response,
) => {
  try {
    const userId = getAuthenticatedUserId(req);
    const categoryId = req.params.id as string;

    const category = await getById(
      userId,
      categoryId,
    );

    return success(
      res,
      200,
      'Data kategori berhasil diambil',
      { data: toCategoryDTO(category) },
    );
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === 'CATEGORY_NOT_FOUND'
    ) {
      return fail(
        res,
        404,
        'Kategori tidak ditemukan',
      );
    }

    logger.error(error);

    return fail(
      res,
      500,
      'Gagal mengambil kategori',
    );
  }
};

export const updateCategoryController = async (
  req: Request,
  res: Response,
) => {
  try {
    const userId = getAuthenticatedUserId(req);
    const categoryId = req.params.id as string;

    await update(userId, categoryId, req.body);

    return success(
      res,
      200,
      'Kategori berhasil diperbarui',
    );
  } catch (error) {
    if (error instanceof Error) {
      switch (error.message) {
        case 'CATEGORY_NOT_FOUND':
          return fail(
            res,
            404,
            'Kategori tidak ditemukan',
          );

        case 'CATEGORY_NAME_EXISTS':
          return fail(
            res,
            409,
            'Nama kategori sudah digunakan',
          );

        case 'PARENT_CATEGORY_NOT_FOUND':
          return fail(
            res,
            404,
            'Kategori induk tidak ditemukan',
          );

        case 'INVALID_PARENT_CATEGORY_TYPE':
          return fail(
            res,
            422,
            'Tipe kategori induk tidak sesuai',
          );

        case 'SELF_PARENT_NOT_ALLOWED':
          return fail(
            res,
            422,
            'Kategori tidak bisa menjadi induk dari dirinya sendiri',
          );
      }
    }

    logger.error(error);

    return fail(
      res,
      500,
      'Gagal memperbarui kategori',
    );
  }
};

export const deleteCategoryController = async (
  req: Request,
  res: Response,
) => {
  try {
    const userId = getAuthenticatedUserId(req);
    const categoryId = req.params.id as string;

    await remove(userId, categoryId);

    return success(
      res,
      200,
      'Kategori berhasil dihapus',
    );
  } catch (error) {
    if (error instanceof Error) {
      switch (error.message) {
        case 'CATEGORY_NOT_FOUND':
          return fail(
            res,
            404,
            'Kategori tidak ditemukan',
          );

        case 'CATEGORY_HAS_CHILDREN':
          return fail(
            res,
            409,
            'Kategori memiliki sub-kategori, hapus terlebih dahulu',
          );

        case 'CATEGORY_IN_USE':
          return fail(
            res,
            409,
            'Kategori sedang digunakan pada transaksi/budget, tidak dapat dihapus',
          );
      }
    }

    logger.error(error);

    return fail(
      res,
      500,
      'Gagal menghapus kategori',
    );
  }
};