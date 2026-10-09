import { prisma } from '../config/database.js';
import type { PaymentView } from '../dtos/expense.dto.js';
import type {
  expense_payments_status,
  expenses_category,
} from '../generated/prisma/enums.js';
import {
  createPayment as createPaymentRecord,
  createPaymentTransaction,
  findSystemCategoryIdForExpense,
  findExpensePayments,
  findGroupManagerIds,
  findPaymentById,
  findUserNameAndTimezone,
  getPaymentTotals,
  lockExpense,
  transitionExpenseStatus,
  transitionPaymentStatus,
  type Db,
  type PaymentRow,
} from '../repositories/expense.repository.js';
import {
  conflict,
  forbidden,
  notFound,
  unprocessable,
} from '../utils/app-error.js';
import type { PaginationParams } from '../utils/pagination.js';
import type { CreateExpensePaymentInput } from '../validators/expense.validator.js';
import { checkBudgetAlerts } from './budget-alert.service.js';
import { centsToDecimal, toCents } from './expense-split.service.js';
import {
  canManageExpense,
  loadExpense,
  notifyExpenseSettled,
  requireGroupMember,
} from './expense.service.js';
import { formatMoney, notify } from './notifier.service.js';
import { resolveFundingSource } from './ownership.service.js';
import { deleteImage, saveImage } from './storage.service.js';
import { toLocalDate } from '../utils/date.js';

const OPEN_STATUSES: expense_payments_status[] = ['pending', 'submitted'];

/* ------------------------------------------------------------------ */
/* Akses & helper                                                      */
/* ------------------------------------------------------------------ */

const loadPayment = async (
  userId: string,
  paymentId: string,
): Promise<PaymentView> => {
  const payment = await findPaymentById(paymentId);

  if (!payment) {
    throw notFound('PAYMENT_NOT_FOUND', 'Pembayaran tidak ditemukan');
  }

  const { viewer } = await requireGroupMember(
    payment.expenses.group_id,
    userId,
  );

  return { payment, viewer };
};

const requireOpenPayment = (payment: PaymentRow) => {
  if (!OPEN_STATUSES.includes(payment.status)) {
    throw paymentAlreadyProcessed();
  }
};

const paymentAlreadyProcessed = () =>
  conflict('PAYMENT_ALREADY_PROCESSED', 'Pembayaran ini sudah diproses');

const expenseNotActive = () =>
  conflict(
    'EXPENSE_NOT_ACTIVE',
    'Pembayaran hanya bisa diproses untuk pengeluaran yang aktif',
  );

const paymentExceedsRemaining = (remainingCents: number, currency: string) =>
  unprocessable(
    'PAYMENT_EXCEEDS_REMAINING',
    remainingCents > 0
      ? `Nominal melebihi sisa tagihan (${formatMoney(remainingCents / 100, currency)})`
      : 'Tagihan ini sudah lunas atau sisanya sedang menunggu konfirmasi',
  );

const requirePaymentManager = ({ payment, viewer }: PaymentView) => {
  if (!canManageExpense(payment.expenses, viewer)) {
    throw forbidden(
      'PAYMENT_ACCESS_DENIED',
      'Hanya pembuat pengeluaran atau admin grup yang bisa memproses pembayaran',
    );
  }
};

const requirePayer = ({ payment, viewer }: PaymentView, action: string) => {
  if (payment.payer_id !== viewer.userId) {
    throw forbidden(
      'PAYMENT_ACCESS_DENIED',
      `Hanya pembayar yang bisa ${action}`,
    );
  }
};

/**
 * Tandai pembayaran confirmed dan catat transaksi pengeluaran di
 * rekening pembayar. Wajib dipanggil di dalam transaksi DB setelah
 * baris pengeluaran dikunci. Mengembalikan true bila tagihan jadi lunas.
 */
const applyConfirmedPayment = async (
  tx: Db,
  params: {
    expense: { id: string; title: string };
    category: expenses_category;
    totalCents: number;
    confirmedCents: number;
    paymentId: string;
    payerId: string;
    accountId: string;
    amountCents: number;
    transactionDate: Date;
  },
) => {
  await createPaymentTransaction(tx, {
    userId: params.payerId,
    accountId: params.accountId,
    paymentId: params.paymentId,
    amount: centsToDecimal(params.amountCents),
    transactionDate: params.transactionDate,
    description: `Patungan: ${params.expense.title}`,
    categoryId: await findSystemCategoryIdForExpense(tx, params.category),
  });

  const settled =
    params.confirmedCents + params.amountCents === params.totalCents;

  if (settled) {
    await transitionExpenseStatus(params.expense.id, ['active'], 'settled', tx);
  }

  return settled;
};

/* ------------------------------------------------------------------ */
/* Pembayaran                                                          */
/* ------------------------------------------------------------------ */

/**
 * Catat pembayaran tagihan oleh user yang login. Bila pembayar adalah
 * pembuat pengeluaran atau owner/admin grup, pembayaran langsung
 * confirmed; selainnya menunggu konfirmasi.
 */
export const createPayment = async (
  userId: string,
  expenseId: string,
  input: CreateExpensePaymentInput,
) => {
  const { expense, viewer } = await loadExpense(userId, expenseId);

  if (expense.status !== 'active') {
    throw expenseNotActive();
  }

  const funding = await resolveFundingSource(userId, input);

  if (!funding.accountId) {
    throw unprocessable(
      'PAYMENT_ACCOUNT_REQUIRED',
      'Pilih rekening, atau metode pembayaran yang terhubung ke rekening, agar pembayaran tercatat di saldo',
    );
  }

  const accountId = funding.accountId;
  const autoConfirm = canManageExpense(expense, viewer);
  const amountCents = toCents(input.amount);
  const paidAt = input.paid_at ? new Date(input.paid_at) : new Date();
  const payer = await findUserNameAndTimezone(userId);
  const transactionDate = toLocalDate(paidAt, payer.timezone);
  const currency = expense.groups.currency;

  const { paymentId, settled } = await prisma.$transaction(async (tx) => {
    const locked = await lockExpense(tx, expenseId);

    if (locked?.status !== 'active') {
      throw expenseNotActive();
    }

    const totals = await getPaymentTotals(expenseId, tx);
    const totalCents = toCents(locked.total_amount);
    const remainingCents =
      totalCents - totals.confirmedCents - totals.pendingCents;

    if (amountCents > remainingCents) {
      throw paymentExceedsRemaining(remainingCents, currency);
    }

    const payment = await createPaymentRecord(tx, {
      expenseId,
      payerId: userId,
      accountId,
      paymentMethodId: funding.paymentMethodId,
      amount: centsToDecimal(amountCents),
      status: autoConfirm ? 'confirmed' : 'pending',
      paidAt,
      note: input.note ?? null,
    });

    if (!autoConfirm) {
      return { paymentId: payment.id, settled: false };
    }

    return {
      paymentId: payment.id,
      settled: await applyConfirmedPayment(tx, {
        expense,
        category: locked.category,
        totalCents,
        confirmedCents: totals.confirmedCents,
        paymentId: payment.id,
        payerId: userId,
        accountId,
        amountCents,
        transactionDate,
      }),
    };
  });

  if (autoConfirm) {
    if (settled) {
      await notifyExpenseSettled(expense, userId);
    }

    await checkBudgetAlerts(userId, transactionDate);
  } else {
    await notify({
      userIds: [
        expense.created_by,
        ...(await findGroupManagerIds(expense.group_id)),
      ],
      type: 'payment',
      title: 'Pembayaran menunggu konfirmasi',
      message: `${payer.name} membayar ${formatMoney(input.amount, currency)} untuk "${expense.title}". Cek lalu konfirmasi pembayarannya.`,
      data: {
        payment_id: paymentId,
        expense_id: expense.id,
        group_id: expense.group_id,
      },
      excludeUserId: userId,
    });
  }

  return loadPayment(userId, paymentId);
};

export const listExpensePayments = async (
  userId: string,
  expenseId: string,
  pagination: PaginationParams,
  status?: expense_payments_status,
) => {
  const { viewer } = await loadExpense(userId, expenseId);
  const { items, total } = await findExpensePayments({
    expenseId,
    status,
    pagination,
  });

  return { items, total, viewer };
};

export const getPayment = loadPayment;

export const confirmPayment = async (userId: string, paymentId: string) => {
  const view = await loadPayment(userId, paymentId);
  const { payment } = view;

  requirePaymentManager(view);
  requireOpenPayment(payment);

  // Data lama tanpa rekening tidak bisa dicatat ke saldo.
  const accountId = payment.account_id;

  if (!accountId) {
    throw unprocessable(
      'PAYMENT_ACCOUNT_REQUIRED',
      'Pembayaran ini tidak punya rekening sumber dana. Minta pembayar membatalkan dan mencatat ulang',
    );
  }

  const payer = await findUserNameAndTimezone(payment.payer_id);
  const transactionDate = toLocalDate(payment.paid_at, payer.timezone);
  const amountCents = toCents(payment.amount);
  const expense = payment.expenses;

  const settled = await prisma.$transaction(async (tx) => {
    const locked = await lockExpense(tx, expense.id);

    if (locked?.status !== 'active') {
      throw expenseNotActive();
    }

    const totals = await getPaymentTotals(expense.id, tx);
    const totalCents = toCents(locked.total_amount);

    if (totals.confirmedCents + amountCents > totalCents) {
      throw paymentExceedsRemaining(
        totalCents - totals.confirmedCents,
        expense.groups.currency,
      );
    }

    const confirmed = await transitionPaymentStatus(
      paymentId,
      OPEN_STATUSES,
      { status: 'confirmed' },
      tx,
    );

    if (!confirmed) {
      throw paymentAlreadyProcessed();
    }

    return applyConfirmedPayment(tx, {
      expense,
      category: locked.category,
      totalCents,
      confirmedCents: totals.confirmedCents,
      paymentId,
      payerId: payment.payer_id,
      accountId,
      amountCents,
      transactionDate,
    });
  });

  const actor = await findUserNameAndTimezone(userId);

  await notify({
    userIds: payment.payer_id,
    type: 'payment',
    title: 'Pembayaran dikonfirmasi',
    message: `Pembayaran ${formatMoney(payment.amount, expense.groups.currency)} untuk "${expense.title}" sudah dikonfirmasi oleh ${actor.name}`,
    data: {
      payment_id: paymentId,
      expense_id: expense.id,
      group_id: expense.group_id,
    },
    excludeUserId: userId,
  });

  if (settled) {
    await notifyExpenseSettled(expense, userId);
  }

  await checkBudgetAlerts(payment.payer_id, transactionDate);

  return loadPayment(userId, paymentId);
};

export const rejectPayment = async (userId: string, paymentId: string) => {
  const view = await loadPayment(userId, paymentId);
  const { payment } = view;

  requirePaymentManager(view);
  requireOpenPayment(payment);

  if (
    !(await transitionPaymentStatus(paymentId, OPEN_STATUSES, {
      status: 'rejected',
    }))
  ) {
    throw paymentAlreadyProcessed();
  }

  const actor = await findUserNameAndTimezone(userId);

  await notify({
    userIds: payment.payer_id,
    type: 'payment',
    title: 'Pembayaran ditolak',
    message: `Pembayaran ${formatMoney(payment.amount, payment.expenses.groups.currency)} untuk "${payment.expenses.title}" ditolak oleh ${actor.name}`,
    data: {
      payment_id: paymentId,
      expense_id: payment.expense_id,
      group_id: payment.expenses.group_id,
    },
    excludeUserId: userId,
  });

  return loadPayment(userId, paymentId);
};

export const cancelPayment = async (userId: string, paymentId: string) => {
  const view = await loadPayment(userId, paymentId);

  requirePayer(view, 'membatalkan pembayaran ini');
  requireOpenPayment(view.payment);

  if (
    !(await transitionPaymentStatus(paymentId, OPEN_STATUSES, {
      status: 'cancelled',
    }))
  ) {
    throw paymentAlreadyProcessed();
  }

  return loadPayment(userId, paymentId);
};

/* ------------------------------------------------------------------ */
/* Bukti bayar                                                         */
/* ------------------------------------------------------------------ */

/**
 * Unggah bukti. Pembayaran yang menunggu → status `submitted` (siap
 * diverifikasi). Pembayaran yang sudah dikonfirmasi (mis. otomatis karena
 * dibayar pembuat/admin) tetap boleh dilengkapi buktinya tanpa mengubah
 * status, agar penalang tetap bisa menyimpan bukti bayar ke merchant.
 */
export const updatePaymentProof = async (
  userId: string,
  paymentId: string,
  file: Express.Multer.File | undefined,
) => {
  const view = await loadPayment(userId, paymentId);
  const isConfirmed = view.payment.status === 'confirmed';

  requirePayer(view, 'mengunggah bukti pembayaran');

  if (!isConfirmed) {
    requireOpenPayment(view.payment);
  }

  const path = await saveImage(file, 'proofs');
  const updated = await (isConfirmed
    ? transitionPaymentStatus(paymentId, ['confirmed'], { proof_url: path })
    : transitionPaymentStatus(paymentId, OPEN_STATUSES, {
        status: 'submitted',
        proof_url: path,
      })
  ).catch(async (error: unknown) => {
    await deleteImage(path);
    throw error;
  });

  if (!updated) {
    await deleteImage(path);
    throw paymentAlreadyProcessed();
  }

  await deleteImage(view.payment.proof_url);

  return loadPayment(userId, paymentId);
};

/** Hapus bukti → status kembali `pending`. */
export const removePaymentProof = async (userId: string, paymentId: string) => {
  const view = await loadPayment(userId, paymentId);

  requirePayer(view, 'menghapus bukti pembayaran');
  requireOpenPayment(view.payment);

  const updated = await transitionPaymentStatus(paymentId, OPEN_STATUSES, {
    status: 'pending',
    proof_url: null,
  });

  if (!updated) {
    throw paymentAlreadyProcessed();
  }

  await deleteImage(view.payment.proof_url);

  return loadPayment(userId, paymentId);
};
