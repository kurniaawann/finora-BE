import type { Request, Response } from 'express';

import { toDateOnly } from '../dtos/common.dto.js';
import { toTransactionDTO } from '../dtos/transaction.dto.js';
import {
  createTransaction,
  deleteTransaction,
  getTransaction,
  getTransactionSummary,
  listTransactions,
  removeTransactionReceipt,
  resolveSummaryPeriod,
  updateTransaction,
  updateTransactionReceipt,
} from '../services/transaction.service.js';
import { getAuthenticatedUserId, getParam } from '../utils/auth.js';
import {
  parseAmountFilter,
  parseDateRangeFilter,
  parseEnumFilter,
  parseIdFilter,
  parseSearchQuery,
} from '../utils/filters.js';
import { buildPaginationMeta, parsePagination } from '../utils/pagination.js';
import { success } from '../utils/response.js';
import { TRANSACTION_TYPES } from '../validators/transaction.validator.js';

export const listTransactionsController = async (
  req: Request,
  res: Response,
) => {
  const pagination = parsePagination(req.query);
  const dateRange = parseDateRangeFilter(req.query);

  const result = await listTransactions(
    getAuthenticatedUserId(req),
    pagination,
    {
      search: parseSearchQuery(req.query),
      type: parseEnumFilter(req.query, 'type', TRANSACTION_TYPES),
      accountId: parseIdFilter(req.query, 'account_id'),
      categoryId: parseIdFilter(req.query, 'category_id'),
      from: dateRange.from,
      to: dateRange.to,
      minAmount: parseAmountFilter(req.query, 'min_amount'),
      maxAmount: parseAmountFilter(req.query, 'max_amount'),
    },
  );

  return success(res, 200, 'Daftar transaksi berhasil diambil', {
    data: result.data.map(toTransactionDTO),
    pagination: buildPaginationMeta(pagination, result.total),
  });
};

export const getTransactionSummaryController = async (
  req: Request,
  res: Response,
) => {
  const userId = getAuthenticatedUserId(req);
  const dateRange = parseDateRangeFilter(req.query);
  const { from, to } = await resolveSummaryPeriod(
    userId,
    dateRange.from,
    dateRange.to,
  );

  const summary = await getTransactionSummary(userId, from, to);

  return success(res, 200, 'Ringkasan transaksi berhasil diambil', {
    data: {
      from_date: toDateOnly(from),
      to_date: toDateOnly(to),
      ...summary,
    },
  });
};

export const getTransactionController = async (
  req: Request,
  res: Response,
) => {
  const transaction = await getTransaction(
    getAuthenticatedUserId(req),
    getParam(req, 'id'),
  );

  return success(res, 200, 'Transaksi berhasil diambil', {
    data: toTransactionDTO(transaction),
  });
};

export const createTransactionController = async (
  req: Request,
  res: Response,
) => {
  const transaction = await createTransaction(
    getAuthenticatedUserId(req),
    req.body,
  );

  return success(res, 201, 'Transaksi berhasil dicatat', {
    data: toTransactionDTO(transaction),
  });
};

export const updateTransactionController = async (
  req: Request,
  res: Response,
) => {
  const transaction = await updateTransaction(
    getAuthenticatedUserId(req),
    getParam(req, 'id'),
    req.body,
  );

  return success(res, 200, 'Transaksi berhasil diperbarui', {
    data: toTransactionDTO(transaction),
  });
};

export const deleteTransactionController = async (
  req: Request,
  res: Response,
) => {
  await deleteTransaction(getAuthenticatedUserId(req), getParam(req, 'id'));

  return success(res, 200, 'Transaksi berhasil dihapus');
};

export const updateTransactionReceiptController = async (
  req: Request,
  res: Response,
) => {
  const transaction = await updateTransactionReceipt(
    getAuthenticatedUserId(req),
    getParam(req, 'id'),
    req.file,
  );

  return success(res, 200, 'Foto struk berhasil diunggah', {
    data: toTransactionDTO(transaction),
  });
};

export const removeTransactionReceiptController = async (
  req: Request,
  res: Response,
) => {
  const transaction = await removeTransactionReceipt(
    getAuthenticatedUserId(req),
    getParam(req, 'id'),
  );

  return success(res, 200, 'Foto struk berhasil dihapus', {
    data: toTransactionDTO(transaction),
  });
};
