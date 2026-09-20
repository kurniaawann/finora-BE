import type { Request, Response } from 'express';

import {
  createTransactionService,
  getTransactionsService,
  getTransactionService,
  updateTransactionService,
  deleteTransactionService,
} from '../services/transaction.service.js';

import { getAuthenticatedUserId } from '../utils/auth.js';
import { fail, success } from '../utils/response.js';
import {
  buildPaginationMeta,
  parsePagination,
} from '../utils/pagination.js';
import {
  parseAmountFilter,
  parseDateRangeFilter,
  parseEnumFilter,
  parseIdFilter,
  parseSearchQuery,
} from '../utils/filters.js';
import { toTransactionDTO } from '../dtos/transaction.dto.js';
import { logger } from '../config/logger.js';

const TRANSACTIONS_TYPES = [
  'income',
  'expense',
  'transfer',
  'refund',
  'adjustment',
] as const;

const TRANSACTIONS_STATUS = [
  'pending',
  'completed',
  'cancelled',
] as const;

export const createTransactionController = async (
  req: Request,
  res: Response,
) => {
  try {
    const userId = getAuthenticatedUserId(req);

    await createTransactionService(
      userId,
      req.body,
    );

    return success(
      res,
      201,
      'Transaksi berhasil dibuat',
    );
  } catch (error) {
    if (error instanceof Error) {
      switch (error.message) {
        case 'ACCOUNT_NOT_FOUND':
          return fail(
            res,
            404,
            'Akun tidak ditemukan',
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
            'Tipe kategori tidak sesuai dengan tipe transaksi',
          );
      }
    }

    logger.error(
      'Create transaction error:',
      error,
    );

    return fail(
      res,
      500,
      'Terjadi kesalahan pada server',
    );
  }
};

export const getTransactionsController = async (
  req: Request,
  res: Response,
) => {
  try {
    const userId = getAuthenticatedUserId(req);

    const { page, perPage } = parsePagination(
      req.query,
    );

    const dateRange = parseDateRangeFilter(req.query);

    const result = await getTransactionsService(
      userId,
      page,
      perPage,
      {
        search: parseSearchQuery(req.query),
        type: parseEnumFilter(
          req.query,
          'type',
          TRANSACTIONS_TYPES,
        ),
        status: parseEnumFilter(
          req.query,
          'status',
          TRANSACTIONS_STATUS,
        ),
        accountId: parseIdFilter(req.query, 'account_id'),
        categoryId: parseIdFilter(req.query, 'category_id'),
        from: dateRange.from,
        to: dateRange.to,
        minAmount: parseAmountFilter(
          req.query,
          'min_amount',
        ),
        maxAmount: parseAmountFilter(
          req.query,
          'max_amount',
        ),
      },
    );

    return success(
      res,
      200,
      'Data transaksi berhasil diambil',
      {
        data: result.data.map(toTransactionDTO),
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

    logger.error(
      'Get transactions error:',
      error,
    );

    return fail(
      res,
      500,
      'Terjadi kesalahan pada server',
    );
  }
};

export const getTransactionController = async (
  req: Request,
  res: Response,
) => {
  try {
    const userId = getAuthenticatedUserId(req);

    const id = req.params.id as string;

    const transaction =
      await getTransactionService(id, userId);

    return success(
      res,
      200,
      'Data transaksi berhasil diambil',
      { data: toTransactionDTO(transaction) },
    );
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === 'TRANSACTION_NOT_FOUND'
    ) {
      return fail(
        res,
        404,
        'Transaksi tidak ditemukan',
      );
    }

    logger.error(
      'Get transaction error:',
      error,
    );

    return fail(
      res,
      500,
      'Terjadi kesalahan pada server',
    );
  }
};

export const updateTransactionController = async (
  req: Request,
  res: Response,
) => {
  try {
    const userId = getAuthenticatedUserId(req);

    const id = req.params.id as string;

    await updateTransactionService(
      id,
      userId,
      req.body,
    );

    return success(
      res,
      200,
      'Transaksi berhasil diperbarui',
    );
  } catch (error) {
    if (error instanceof Error) {
      switch (error.message) {
        case 'TRANSACTION_NOT_FOUND':
          return fail(
            res,
            404,
            'Transaksi tidak ditemukan',
          );

        case 'ACCOUNT_NOT_FOUND':
          return fail(
            res,
            404,
            'Akun tidak ditemukan',
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
            'Tipe kategori tidak sesuai dengan tipe transaksi',
          );

        case 'INVALID_AMOUNT':
          return fail(
            res,
            422,
            'Nominal transaksi tidak valid',
          );

        case 'TRANSFER_TRANSACTION_NOT_ALLOWED':
          return fail(
            res,
            422,
            'Transaksi transfer harus dikelola melalui fitur transfer',
          );
      }
    }

    logger.error(
      'Update transaction error:',
      error,
    );

    return fail(
      res,
      500,
      'Terjadi kesalahan pada server',
    );
  }
};

export const deleteTransactionController = async (
  req: Request,
  res: Response,
) => {
  try {
    const userId = getAuthenticatedUserId(req);

    const id = req.params.id as string;

    await deleteTransactionService(
      id,
      userId,
    );

    return success(
      res,
      200,
      'Transaksi berhasil dihapus',
    );
  } catch (error) {
    if (error instanceof Error) {
      switch (error.message) {
        case 'TRANSACTION_NOT_FOUND':
          return fail(
            res,
            404,
            'Transaksi tidak ditemukan',
          );

        case 'TRANSFER_TRANSACTION_NOT_ALLOWED':
          return fail(
            res,
            422,
            'Transaksi transfer harus dikelola melalui fitur transfer',
          );
      }
    }

    logger.error(
      'Delete transaction error:',
      error,
    );

    return fail(
      res,
      500,
      'Terjadi kesalahan pada server',
    );
  }
};