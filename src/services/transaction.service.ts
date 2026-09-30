import { Prisma } from '../generated/prisma/client.js';
import type { transactions_type } from '../generated/prisma/enums.js';
import { toCategoryRef, toMoney, toPercentage } from '../dtos/common.dto.js';
import {
  getTransactionSource,
  type TransactionSource,
  type TransactionSummaryDTO,
} from '../dtos/transaction.dto.js';
import {
  createTransaction as insertTransaction,
  deleteTransaction as removeTransaction,
  findCategoryRefs,
  findTransactionById,
  findTransactions,
  sumTransactionsInPeriod,
  updateTransaction as saveTransaction,
  type TransactionFilters,
} from '../repositories/transaction.repository.js';
import { conflict, notFound, unprocessable } from '../utils/app-error.js';
import type { PaginationParams } from '../utils/pagination.js';
import type {
  CreateTransactionInput,
  UpdateTransactionInput,
} from '../validators/transaction.validator.js';
import { checkBudgetAlerts } from './budget-alert.service.js';
import {
  requireOwnedAccount,
  requireUsableCategory,
} from './ownership.service.js';
import { findUserTimeZone } from '../repositories/user.repository.js';
import { formatDateInTimeZone } from '../utils/date.js';


const LINKED_SOURCE_LABELS: Partial<Record<TransactionSource, string>> = {
  group_expense: 'pembayaran patungan',
  settlement: 'pelunasan utang',
  savings: 'setoran tabungan',
};

const toDate = (value: string) => new Date(`${value}T00:00:00.000Z`);

const requireTransaction = async (userId: string, transactionId: string) => {
  const transaction = await findTransactionById(transactionId, userId);

  if (!transaction) {
    throw notFound('TRANSACTION_NOT_FOUND', 'Transaksi tidak ditemukan');
  }

  if (transaction.type === 'transfer') {
    throw conflict(
      'TRANSFER_TRANSACTION_NOT_ALLOWED',
      'Transaksi transfer hanya bisa diubah atau dihapus lewat menu Transfer',
    );
  }

  return transaction;
};

/** Label fitur asal bila transaksi adalah catatan sistem, selain itu null. */
const getLinkedLabel = (
  transaction: Parameters<typeof getTransactionSource>[0],
) => LINKED_SOURCE_LABELS[getTransactionSource(transaction)] ?? null;

/**
 * Kategori wajib cocok dengan jenis transaksi: pemasukan & refund
 * memakai kategori income, pengeluaran memakai kategori expense,
 * penyesuaian saldo tidak memakai kategori.
 */
const resolveCategoryId = async (
  userId: string,
  type: transactions_type,
  categoryId: string | null | undefined,
) => {
  if (!categoryId) {
    return null;
  }

  if (type === 'adjustment') {
    throw unprocessable(
      'CATEGORY_NOT_ALLOWED',
      'Penyesuaian saldo tidak memakai kategori',
    );
  }

  const category = await requireUsableCategory(categoryId, userId);
  const expected = type === 'expense' ? 'expense' : 'income';

  if (category.type !== expected) {
    throw unprocessable(
      'CATEGORY_TYPE_MISMATCH',
      expected === 'expense'
        ? 'Pengeluaran harus memakai kategori pengeluaran'
        : 'Pemasukan dan refund harus memakai kategori pemasukan',
    );
  }

  return category.id;
};

export const listTransactions = (
  userId: string,
  pagination: PaginationParams,
  filters: TransactionFilters,
) => findTransactions({ userId, ...pagination, filters });

export const getTransaction = async (userId: string, transactionId: string) => {
  const transaction = await findTransactionById(transactionId, userId);

  if (!transaction) {
    throw notFound('TRANSACTION_NOT_FOUND', 'Transaksi tidak ditemukan');
  }

  return transaction;
};

export const createTransaction = async (
  userId: string,
  input: CreateTransactionInput,
) => {
  await requireOwnedAccount(input.account_id, userId);

  const categoryId = await resolveCategoryId(
    userId,
    input.type,
    input.category_id,
  );

  const transaction = await insertTransaction({
    users: { connect: { id: userId } },
    accounts: { connect: { id: input.account_id } },
    ...(categoryId ? { categories: { connect: { id: categoryId } } } : {}),
    type: input.type,
    status: 'completed',
    amount: input.amount,
    transaction_date: toDate(input.transaction_date),
    description: input.description ?? null,
    merchant: input.merchant ?? null,
    reference_number: input.reference_number ?? null,
  });

  if (transaction.type === 'expense') {
    await checkBudgetAlerts(userId, transaction.transaction_date);
  }

  return transaction;
};

export const updateTransaction = async (
  userId: string,
  transactionId: string,
  input: UpdateTransactionInput,
) => {
  const current = await requireTransaction(userId, transactionId);

  const type = input.type ?? current.type;
  const accountId = input.account_id ?? current.account_id;
  const amount = new Prisma.Decimal(input.amount ?? current.amount);
  const transactionDate = input.transaction_date
    ? toDate(input.transaction_date)
    : current.transaction_date;
  const referenceNumber =
    input.reference_number !== undefined
      ? input.reference_number
      : current.reference_number;

  const linkedLabel = getLinkedLabel(current);

  if (linkedLabel) {
    const lockedFieldChanged =
      type !== current.type ||
      accountId !== current.account_id ||
      !amount.equals(current.amount) ||
      transactionDate.getTime() !== current.transaction_date.getTime() ||
      referenceNumber !== current.reference_number;

    if (lockedFieldChanged) {
      throw conflict(
        'TRANSACTION_LOCKED',
        `Transaksi ini tercatat otomatis dari ${linkedLabel}, hanya deskripsi, merchant, dan kategori yang bisa diubah`,
      );
    }
  }

  if (type !== 'adjustment' && amount.isNegative()) {
    throw unprocessable('INVALID_AMOUNT', 'Nominal harus lebih besar dari 0');
  }

  if (accountId !== current.account_id) {
    await requireOwnedAccount(accountId, userId);
  }

  // Penyesuaian saldo otomatis dilepas dari kategorinya; kategori lama
  // dicek ulang bila jenis transaksi berubah.
  let categoryId: string | null;

  if (input.category_id !== undefined) {
    categoryId = await resolveCategoryId(userId, type, input.category_id);
  } else if (type === 'adjustment') {
    categoryId = null;
  } else if (type !== current.type) {
    categoryId = await resolveCategoryId(userId, type, current.category_id);
  } else {
    categoryId = current.category_id;
  }

  const transaction = await saveTransaction(transactionId, {
    type,
    account_id: accountId,
    category_id: categoryId,
    amount,
    transaction_date: transactionDate,
    reference_number: referenceNumber,
    ...(input.description !== undefined
      ? { description: input.description }
      : {}),
    ...(input.merchant !== undefined ? { merchant: input.merchant } : {}),
  });

  if (transaction.type === 'expense') {
    await checkBudgetAlerts(userId, transaction.transaction_date);
  }

  return transaction;
};

export const deleteTransaction = async (
  userId: string,
  transactionId: string,
) => {
  const transaction = await requireTransaction(userId, transactionId);
  const linkedLabel = getLinkedLabel(transaction);

  if (linkedLabel) {
    throw conflict(
      'TRANSACTION_LOCKED',
      `Transaksi ini tercatat otomatis dari ${linkedLabel} dan tidak bisa dihapus di sini`,
    );
  }

  await removeTransaction(transactionId);
};

/**
 * Periode ringkasan. Tanpa `to` → akhir bulan dari `from`, atau akhir
 * bulan berjalan menurut zona waktu user bila keduanya kosong. Tanpa
 * `from` → awal bulan dari `to`.
 */
export const resolveSummaryPeriod = async (
  userId: string,
  from?: Date,
  to?: Date,
) => {
  let end = to;

  if (!end) {
    const [year, month] = from
      ? [from.getUTCFullYear(), from.getUTCMonth() + 1]
      : formatDateInTimeZone(new Date(), await findUserTimeZone(userId))
          .split('-')
          .map(Number);

    end = new Date(Date.UTC(year, month, 0));
  }

  const start =
    from ?? new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1));

  return { from: start, to: end };
};

/**
 * Ringkasan arus kas pada periode (hanya transaksi completed):
 * - income  = pemasukan + refund
 * - expense = pengeluaran (tanpa setoran tabungan & transfer)
 * - saved   = setoran tabungan bersih
 * - by_category = pengeluaran per kategori, nominal terbesar dulu
 */
export const getTransactionSummary = async (
  userId: string,
  from: Date,
  to: Date,
): Promise<TransactionSummaryDTO> => {
  const { regular, savings } = await sumTransactionsInPeriod(
    userId,
    from,
    to,
  );

  const zero = new Prisma.Decimal(0);
  let income = zero;
  let expense = zero;
  let saved = zero;
  const expenseByCategory = new Map<string | null, Prisma.Decimal>();

  for (const row of regular) {
    const amount = row._sum.amount ?? zero;

    if (row.type === 'expense') {
      expense = expense.add(amount);
      expenseByCategory.set(
        row.category_id,
        (expenseByCategory.get(row.category_id) ?? zero).add(amount),
      );
    } else {
      income = income.add(amount);
    }
  }

  for (const row of savings) {
    const amount = row._sum.amount ?? zero;

    saved = row.type === 'expense' ? saved.add(amount) : saved.sub(amount);
  }

  const categoryIds = [...expenseByCategory.keys()].filter(
    (id): id is string => id !== null,
  );
  const categories = new Map(
    (await findCategoryRefs(categoryIds)).map((category) => [
      category.id,
      toCategoryRef(category),
    ]),
  );

  const byCategory = [...expenseByCategory.entries()]
    .sort(([, a], [, b]) => b.comparedTo(a))
    .map(([categoryId, amount]) => ({
      category: categoryId ? (categories.get(categoryId) ?? null) : null,
      amount: toMoney(amount),
      percentage: toPercentage(amount.toNumber(), expense.toNumber()),
    }));

  return {
    income: toMoney(income),
    expense: toMoney(expense),
    saved: toMoney(saved),
    net: toMoney(income.sub(expense)),
    by_category: byCategory,
  };
};
