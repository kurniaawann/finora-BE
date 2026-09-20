import type { Request, Response } from 'express';

import {
  create,
  getAll,
  getById,
  remove,
  update,
} from '../services/account.service.js';

import { getAuthenticatedUserId } from '../utils/auth.js';
import {
  buildPaginationMeta,
  parsePagination,
} from '../utils/pagination.js';
import {
  parseBooleanFilter,
  parseEnumFilter,
  parseSearchQuery,
} from '../utils/filters.js';
import { toAccountDTO } from '../dtos/account.dto.js';
import { fail, success } from '../utils/response.js';
import { logger } from '../config/logger.js';

const ACCOUNTS_TYPES = [
  'cash',
  'bank',
  'e_wallet',
  'credit_card',
  'investment',
  'other',
] as const;

export const createAccountController = async (
  req: Request,
  res: Response,
) => {
  try {
    const userId = getAuthenticatedUserId(req);

    await create(
      userId,
      req.body,
    );

    return success(
      res,
      201,
      'Account berhasil dibuat',
    );
  } catch (error) {
    logger.error(error);

    return fail(
      res,
      500,
      'Gagal membuat account',
    );
  }
};

export const getAccountsController = async (
  req: Request,
  res: Response,
) => {
  try {
    const userId = getAuthenticatedUserId(req);

    const { page, perPage } = parsePagination(
      req.query,
    );

    const result = await getAll(userId, page, perPage, {
      search: parseSearchQuery(req.query),
      type: parseEnumFilter(
        req.query,
        'type',
        ACCOUNTS_TYPES,
      ),
      isActive: parseBooleanFilter(
        req.query,
        'is_active',
      ),
    });

    return success(
      res,
      200,
      'Data account berhasil diambil',
      {
        data: result.data.map(toAccountDTO),
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
      'Gagal mengambil account',
    );
  }
};

export const getAccountController = async (
  req: Request,
  res: Response,
) => {
  try {
    const userId = getAuthenticatedUserId(req);
    const accountId = req.params.id as string;

    const account = await getById(
      userId,
      accountId,
    );

    return success(
      res,
      200,
      'Data account berhasil diambil',
      { data: toAccountDTO(account) },
    );
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === 'ACCOUNT_NOT_FOUND'
    ) {
      return fail(
        res,
        404,
        'Account tidak ditemukan',
      );
    }

    logger.error(error);

    return fail(
      res,
      500,
      'Gagal mengambil account',
    );
  }
};

export const updateAccountController = async (
  req: Request,
  res: Response,
) => {
  try {
    const userId = getAuthenticatedUserId(req);
    const accountId = req.params.id as string;

    await update(
      userId,
      accountId,
      req.body,
    );

    return success(
      res,
      200,
      'Account berhasil diperbarui',
    );
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === 'ACCOUNT_NOT_FOUND'
    ) {
      return fail(
        res,
        404,
        'Account tidak ditemukan',
      );
    }

    logger.error(error);

    return fail(
      res,
      500,
      'Gagal memperbarui account',
    );
  }
};

export const deleteAccountController = async (
  req: Request,
  res: Response,
) => {
  try {
    const userId = getAuthenticatedUserId(req);
    const accountId = req.params.id as string;

    await remove(
      userId,
      accountId,
    );

    return success(
      res,
      200,
      'Account berhasil dinonaktifkan',
    );
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === 'ACCOUNT_NOT_FOUND'
    ) {
      return fail(
        res,
        404,
        'Account tidak ditemukan',
      );
    }

    logger.error(error);

    return fail(
      res,
      500,
      'Gagal menghapus account',
    );
  }
};