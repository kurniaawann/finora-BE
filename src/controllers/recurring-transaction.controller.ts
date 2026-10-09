import type { Request, Response } from 'express';

import {
  toRecurringDTO,
  toRecurringRunTransactionDTO,
} from '../dtos/recurring-transaction.dto.js';
import {
  addRecurringTransaction,
  editRecurringTransaction,
  getRecurringTransaction,
  listRecurringTransactions,
  removeRecurringTransaction,
  runRecurringTransactionNow,
} from '../services/recurring-transaction.service.js';
import { getAuthenticatedUserId, getParam } from '../utils/auth.js';
import {
  parseBooleanFilter,
  parseDateRangeFilter,
  parseEnumFilter,
  parseIdFilter,
  parseSearchQuery,
} from '../utils/filters.js';
import { buildPaginationMeta, parsePagination } from '../utils/pagination.js';
import { success } from '../utils/response.js';
import {
  RECURRING_FREQUENCIES,
  RECURRING_TYPES,
} from '../validators/recurring-transaction.validator.js';

export const listRecurringTransactionsController = async (
  req: Request,
  res: Response,
) => {
  const pagination = parsePagination(req.query);
  const { from, to } = parseDateRangeFilter(req.query);

  const result = await listRecurringTransactions(
    getAuthenticatedUserId(req),
    pagination,
    {
      search: parseSearchQuery(req.query),
      type: parseEnumFilter(req.query, 'type', RECURRING_TYPES),
      frequency: parseEnumFilter(req.query, 'frequency', RECURRING_FREQUENCIES),
      isActive: parseBooleanFilter(req.query, 'is_active'),
      accountId: parseIdFilter(req.query, 'account_id'),
      categoryId: parseIdFilter(req.query, 'category_id'),
      from,
      to,
    },
  );

  return success(res, 200, 'Transaksi berulang berhasil diambil', {
    data: result.data.map(toRecurringDTO),
    pagination: buildPaginationMeta(pagination, result.total),
  });
};

export const getRecurringTransactionController = async (
  req: Request,
  res: Response,
) => {
  const recurring = await getRecurringTransaction(
    getAuthenticatedUserId(req),
    getParam(req, 'id'),
  );

  return success(res, 200, 'Transaksi berulang berhasil diambil', {
    data: toRecurringDTO(recurring),
  });
};

export const createRecurringTransactionController = async (
  req: Request,
  res: Response,
) => {
  const recurring = await addRecurringTransaction(
    getAuthenticatedUserId(req),
    req.body,
  );

  return success(res, 201, 'Transaksi berulang berhasil dibuat', {
    data: toRecurringDTO(recurring),
  });
};

export const updateRecurringTransactionController = async (
  req: Request,
  res: Response,
) => {
  const recurring = await editRecurringTransaction(
    getAuthenticatedUserId(req),
    getParam(req, 'id'),
    req.body,
  );

  return success(res, 200, 'Transaksi berulang berhasil diperbarui', {
    data: toRecurringDTO(recurring),
  });
};

export const deleteRecurringTransactionController = async (
  req: Request,
  res: Response,
) => {
  await removeRecurringTransaction(
    getAuthenticatedUserId(req),
    getParam(req, 'id'),
  );

  return success(res, 200, 'Transaksi berulang berhasil dihapus');
};

export const runRecurringTransactionController = async (
  req: Request,
  res: Response,
) => {
  const { transaction, recurring } = await runRecurringTransactionNow(
    getAuthenticatedUserId(req),
    getParam(req, 'id'),
  );

  return success(res, 200, 'Transaksi berulang berhasil dijalankan', {
    data: {
      transaction: toRecurringRunTransactionDTO(transaction),
      recurring: toRecurringDTO(recurring),
    },
  });
};
