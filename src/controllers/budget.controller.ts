import type { Request, Response } from 'express';

import {
  create,
  getAll,
  getById,
  remove,
  update,
} from '../services/budget.service.js';

import { getAuthenticatedUserId } from '../utils/auth.js';
import {
  buildPaginationMeta,
  parsePagination,
} from '../utils/pagination.js';
import {
  parseBooleanFilter,
  parseDateRangeFilter,
  parseIdFilter,
  parseSearchQuery,
} from '../utils/filters.js';
import {
  toBudgetDTO,
  toBudgetSummaryDTO,
} from '../dtos/budget.dto.js';
import { fail, success } from '../utils/response.js';
import { logger } from '../config/logger.js';

export const createBudgetController = async (
  req: Request,
  res: Response,
) => {
  try {
    const userId = getAuthenticatedUserId(req);

    const budget = await create(userId, req.body);

    return success(
      res,
      201,
      'Budget berhasil dibuat',
      { data: toBudgetDTO(budget) },
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

        case 'INVALID_CATEGORY_TYPE':
          return fail(
            res,
            422,
            'Budget hanya boleh memakai kategori pengeluaran',
          );

        case 'INVALID_DATE_RANGE':
          return fail(
            res,
            422,
            'Tanggal selesai tidak boleh sebelum tanggal mulai',
          );

        case 'ALLOCATION_EXCEEDS_BUDGET':
          return fail(
            res,
            422,
            'Total alokasi kategori tidak boleh melebihi total budget',
          );
      }
    }

    logger.error(error);

    return fail(
      res,
      500,
      'Gagal membuat budget',
    );
  }
};

export const getBudgetsController = async (
  req: Request,
  res: Response,
) => {
  try {
    const userId = getAuthenticatedUserId(req);

    const { page, perPage } = parsePagination(
      req.query,
    );

    const dateRange = parseDateRangeFilter(req.query);

    const result = await getAll(
      userId,
      page,
      perPage,
      {
        search: parseSearchQuery(req.query),
        isActive: parseBooleanFilter(
          req.query,
          'is_active',
        ),
        categoryId: parseIdFilter(
          req.query,
          'category_id',
        ),
        from: dateRange.from,
        to: dateRange.to,
      },
    );

    return success(
      res,
      200,
      'Data budget berhasil diambil',
      {
        data: result.data.map((budget) =>
          toBudgetSummaryDTO(
            budget,
            result.spentMap.get(budget.id),
          ),
        ),
        pagination: buildPaginationMeta(
          { page, perPage },
          result.total,
        ),
      },
    );
  } catch (error) {
    if (error instanceof TypeError) {
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
      'Gagal mengambil budget',
    );
  }
};

export const getBudgetController = async (
  req: Request,
  res: Response,
) => {
  try {
    const userId = getAuthenticatedUserId(req);
    const budgetId = req.params.id as string;

    const { budget, spentByCategory } =
      await getById(userId, budgetId);

    return success(
      res,
      200,
      'Data budget berhasil diambil',
      {
        data: toBudgetDTO(
          budget,
          spentByCategory,
        ),
      },
    );
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === 'BUDGET_NOT_FOUND'
    ) {
      return fail(
        res,
        404,
        'Budget tidak ditemukan',
      );
    }

    logger.error(error);

    return fail(
      res,
      500,
      'Gagal mengambil budget',
    );
  }
};

export const updateBudgetController = async (
  req: Request,
  res: Response,
) => {
  try {
    const userId = getAuthenticatedUserId(req);
    const budgetId = req.params.id as string;

    const { budget, spentByCategory } =
      await update(userId, budgetId, req.body);

    return success(
      res,
      200,
      'Budget berhasil diperbarui',
      {
        data: toBudgetDTO(
          budget,
          spentByCategory,
        ),
      },
    );
  } catch (error) {
    if (error instanceof Error) {
      switch (error.message) {
        case 'BUDGET_NOT_FOUND':
          return fail(
            res,
            404,
            'Budget tidak ditemukan',
          );

        case 'CATEGORY_NOT_FOUND':
          return fail(
            res,
            404,
            'Kategori tidak ditemukan',
          );

        case 'INVALID_CATEGORY_TYPE':
          return fail(
            res,
            422,
            'Budget hanya boleh memakai kategori pengeluaran',
          );

        case 'INVALID_DATE_RANGE':
          return fail(
            res,
            422,
            'Tanggal selesai tidak boleh sebelum tanggal mulai',
          );

        case 'ALLOCATION_EXCEEDS_BUDGET':
          return fail(
            res,
            422,
            'Total alokasi kategori tidak boleh melebihi total budget',
          );
      }
    }

    logger.error(error);

    return fail(
      res,
      500,
      'Gagal memperbarui budget',
    );
  }
};

export const deleteBudgetController = async (
  req: Request,
  res: Response,
) => {
  try {
    const userId = getAuthenticatedUserId(req);
    const budgetId = req.params.id as string;

    await remove(userId, budgetId);

    return success(
      res,
      200,
      'Budget berhasil dihapus',
    );
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === 'BUDGET_NOT_FOUND'
    ) {
      return fail(
        res,
        404,
        'Budget tidak ditemukan',
      );
    }

    logger.error(error);

    return fail(
      res,
      500,
      'Gagal menghapus budget',
    );
  }
};
