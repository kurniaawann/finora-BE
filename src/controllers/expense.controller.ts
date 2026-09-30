import type { Request, Response } from 'express';

import {
  toExpenseDetailDTO,
  toExpenseListItemDTO,
  toExpensePaymentDTO,
} from '../dtos/expense.dto.js';
import {
  cancelPayment,
  confirmPayment,
  createPayment,
  getPayment,
  listExpensePayments,
  rejectPayment,
  removePaymentProof,
  updatePaymentProof,
} from '../services/expense-payment.service.js';
import {
  activateExpense,
  cancelExpense,
  createExpense,
  deleteExpense,
  getExpense,
  listGroupExpenses,
  removeExpenseReceiptPhoto,
  updateExpense,
  updateExpenseReceiptPhoto,
} from '../services/expense.service.js';
import { getAuthenticatedUserId, getParam } from '../utils/auth.js';
import {
  parseAmountFilter,
  parseBooleanFilter,
  parseDateRangeFilter,
  parseEnumFilter,
  parseIdFilter,
  parseSearchQuery,
} from '../utils/filters.js';
import { buildPaginationMeta, parsePagination } from '../utils/pagination.js';
import { success } from '../utils/response.js';
import {
  EXPENSE_CATEGORIES,
  EXPENSE_PAYMENT_STATUSES,
  EXPENSE_STATUSES,
} from '../validators/expense.validator.js';

/* ------------------------------------------------------------------ */
/* Pengeluaran                                                         */
/* ------------------------------------------------------------------ */

export const createExpenseController = async (req: Request, res: Response) => {
  const view = await createExpense(
    getAuthenticatedUserId(req),
    getParam(req, 'groupId'),
    req.body,
  );

  return success(res, 201, 'Pengeluaran berhasil dibuat', {
    data: toExpenseDetailDTO(view),
  });
};

export const listGroupExpensesController = async (
  req: Request,
  res: Response,
) => {
  const pagination = parsePagination(req.query);
  const { from, to } = parseDateRangeFilter(req.query);

  const { items, total, totals } = await listGroupExpenses(
    getAuthenticatedUserId(req),
    getParam(req, 'groupId'),
    pagination,
    {
      search: parseSearchQuery(req.query),
      status: parseEnumFilter(req.query, 'status', EXPENSE_STATUSES),
      category: parseEnumFilter(req.query, 'category', EXPENSE_CATEGORIES),
      eventId: parseIdFilter(req.query, 'event_id'),
      createdBy: parseIdFilter(req.query, 'created_by'),
      from,
      to,
      minAmount: parseAmountFilter(req.query, 'min_amount'),
      maxAmount: parseAmountFilter(req.query, 'max_amount'),
      involvingMe: parseBooleanFilter(req.query, 'involving_me'),
    },
  );

  return success(res, 200, 'Daftar pengeluaran berhasil diambil', {
    data: items.map((expense) =>
      toExpenseListItemDTO(expense, totals.get(expense.id)),
    ),
    pagination: buildPaginationMeta(pagination, total),
  });
};

export const getExpenseController = async (req: Request, res: Response) => {
  const view = await getExpense(getAuthenticatedUserId(req), getParam(req, 'id'));

  return success(res, 200, 'Pengeluaran berhasil diambil', {
    data: toExpenseDetailDTO(view),
  });
};

export const updateExpenseController = async (req: Request, res: Response) => {
  const view = await updateExpense(
    getAuthenticatedUserId(req),
    getParam(req, 'id'),
    req.body,
  );

  return success(res, 200, 'Pengeluaran berhasil diperbarui', {
    data: toExpenseDetailDTO(view),
  });
};

export const deleteExpenseController = async (req: Request, res: Response) => {
  await deleteExpense(getAuthenticatedUserId(req), getParam(req, 'id'));

  return success(res, 200, 'Pengeluaran berhasil dihapus');
};

export const activateExpenseController = async (
  req: Request,
  res: Response,
) => {
  const view = await activateExpense(
    getAuthenticatedUserId(req),
    getParam(req, 'id'),
  );

  return success(res, 200, 'Pengeluaran berhasil diaktifkan', {
    data: toExpenseDetailDTO(view),
  });
};

export const cancelExpenseController = async (req: Request, res: Response) => {
  const view = await cancelExpense(
    getAuthenticatedUserId(req),
    getParam(req, 'id'),
  );

  return success(res, 200, 'Pengeluaran berhasil dibatalkan', {
    data: toExpenseDetailDTO(view),
  });
};

export const updateExpenseReceiptController = async (
  req: Request,
  res: Response,
) => {
  const view = await updateExpenseReceiptPhoto(
    getAuthenticatedUserId(req),
    getParam(req, 'id'),
    req.file,
  );

  return success(res, 200, 'Foto struk berhasil diperbarui', {
    data: toExpenseDetailDTO(view),
  });
};

export const removeExpenseReceiptController = async (
  req: Request,
  res: Response,
) => {
  const view = await removeExpenseReceiptPhoto(
    getAuthenticatedUserId(req),
    getParam(req, 'id'),
  );

  return success(res, 200, 'Foto struk berhasil dihapus', {
    data: toExpenseDetailDTO(view),
  });
};

/* ------------------------------------------------------------------ */
/* Pembayaran tagihan                                                  */
/* ------------------------------------------------------------------ */

export const createPaymentController = async (req: Request, res: Response) => {
  const view = await createPayment(
    getAuthenticatedUserId(req),
    getParam(req, 'id'),
    req.body,
  );

  return success(
    res,
    201,
    view.payment.status === 'confirmed'
      ? 'Pembayaran berhasil dicatat'
      : 'Pembayaran berhasil dicatat, menunggu konfirmasi',
    { data: toExpensePaymentDTO(view) },
  );
};

export const listPaymentsController = async (req: Request, res: Response) => {
  const pagination = parsePagination(req.query);

  const { items, total, viewer } = await listExpensePayments(
    getAuthenticatedUserId(req),
    getParam(req, 'id'),
    pagination,
    parseEnumFilter(req.query, 'status', EXPENSE_PAYMENT_STATUSES),
  );

  return success(res, 200, 'Daftar pembayaran berhasil diambil', {
    data: items.map((payment) => toExpensePaymentDTO({ payment, viewer })),
    pagination: buildPaginationMeta(pagination, total),
  });
};

export const getPaymentController = async (req: Request, res: Response) => {
  const view = await getPayment(
    getAuthenticatedUserId(req),
    getParam(req, 'paymentId'),
  );

  return success(res, 200, 'Pembayaran berhasil diambil', {
    data: toExpensePaymentDTO(view),
  });
};

export const confirmPaymentController = async (req: Request, res: Response) => {
  const view = await confirmPayment(
    getAuthenticatedUserId(req),
    getParam(req, 'paymentId'),
  );

  return success(res, 200, 'Pembayaran berhasil dikonfirmasi', {
    data: toExpensePaymentDTO(view),
  });
};

export const rejectPaymentController = async (req: Request, res: Response) => {
  const view = await rejectPayment(
    getAuthenticatedUserId(req),
    getParam(req, 'paymentId'),
  );

  return success(res, 200, 'Pembayaran berhasil ditolak', {
    data: toExpensePaymentDTO(view),
  });
};

export const cancelPaymentController = async (req: Request, res: Response) => {
  const view = await cancelPayment(
    getAuthenticatedUserId(req),
    getParam(req, 'paymentId'),
  );

  return success(res, 200, 'Pembayaran berhasil dibatalkan', {
    data: toExpensePaymentDTO(view),
  });
};

export const updatePaymentProofController = async (
  req: Request,
  res: Response,
) => {
  const view = await updatePaymentProof(
    getAuthenticatedUserId(req),
    getParam(req, 'paymentId'),
    req.file,
  );

  return success(res, 200, 'Bukti pembayaran berhasil diunggah', {
    data: toExpensePaymentDTO(view),
  });
};

export const removePaymentProofController = async (
  req: Request,
  res: Response,
) => {
  const view = await removePaymentProof(
    getAuthenticatedUserId(req),
    getParam(req, 'paymentId'),
  );

  return success(res, 200, 'Bukti pembayaran berhasil dihapus', {
    data: toExpensePaymentDTO(view),
  });
};
