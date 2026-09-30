import { prisma } from '../config/database.js';
import type { Prisma } from '../generated/prisma/client.js';
import type { transactions_type } from '../generated/prisma/enums.js';
import { accountRefSelect, categoryRefSelect } from '../dtos/common.dto.js';

export interface TransactionFilters {
  search?: string;
  type?: transactions_type;
  accountId?: string;
  categoryId?: string;
  from?: Date;
  to?: Date;
  minAmount?: number;
  maxAmount?: number;
}

const transactionInclude = {
  accounts: { select: accountRefSelect },
  categories: { select: categoryRefSelect },
  // Dipakai untuk menentukan arah & id transfer pada kaki transaksi transfer.
  transfers_transfers_from_transaction_idTotransactions: {
    select: { id: true },
  },
  transfers_transfers_to_transaction_idTotransactions: {
    select: { id: true },
  },
} satisfies Prisma.transactionsInclude;

export const createTransaction = (data: Prisma.transactionsCreateInput) =>
  prisma.transactions.create({ data, include: transactionInclude });

export const findTransactions = async (params: {
  userId: string;
  page: number;
  perPage: number;
  filters: TransactionFilters;
}) => {
  const { filters } = params;
  const conditions: Prisma.transactionsWhereInput[] = [
    { user_id: params.userId },
  ];

  if (filters.search) {
    conditions.push({
      OR: [
        { description: { contains: filters.search } },
        { merchant: { contains: filters.search } },
      ],
    });
  }

  if (filters.type) {
    conditions.push({ type: filters.type });
  }

  if (filters.accountId) {
    conditions.push({ account_id: filters.accountId });
  }

  if (filters.categoryId) {
    conditions.push({ category_id: filters.categoryId });
  }

  if (filters.from || filters.to) {
    conditions.push({
      transaction_date: { gte: filters.from, lte: filters.to },
    });
  }

  if (filters.minAmount !== undefined || filters.maxAmount !== undefined) {
    conditions.push({
      amount: { gte: filters.minAmount, lte: filters.maxAmount },
    });
  }

  const where: Prisma.transactionsWhereInput = { AND: conditions };

  const [data, total] = await prisma.$transaction([
    prisma.transactions.findMany({
      where,
      include: transactionInclude,
      orderBy: [{ transaction_date: 'desc' }, { created_at: 'desc' }],
      skip: (params.page - 1) * params.perPage,
      take: params.perPage,
    }),
    prisma.transactions.count({ where }),
  ]);

  return { data, total };
};

export const findTransactionById = (transactionId: string, userId: string) =>
  prisma.transactions.findFirst({
    where: { id: transactionId, user_id: userId },
    include: transactionInclude,
  });

export const updateTransaction = (
  transactionId: string,
  data: Prisma.transactionsUncheckedUpdateInput,
) =>
  prisma.transactions.update({
    where: { id: transactionId },
    data,
    include: transactionInclude,
  });

export const deleteTransaction = (transactionId: string) =>
  prisma.transactions.delete({ where: { id: transactionId } });

/**
 * Total transaksi completed pada periode. Transaksi setoran tabungan
 * dipisah karena bukan pemasukan/pengeluaran biasa.
 */
export const sumTransactionsInPeriod = async (
  userId: string,
  from: Date,
  to: Date,
) => {
  const base: Prisma.transactionsWhereInput = {
    user_id: userId,
    status: 'completed',
    transaction_date: { gte: from, lte: to },
  };

  const [regular, savings] = await Promise.all([
    prisma.transactions.groupBy({
      by: ['type', 'category_id'],
      where: {
        ...base,
        type: { in: ['income', 'refund', 'expense'] },
        savings_contribution_id: null,
      },
      _sum: { amount: true },
    }),
    prisma.transactions.groupBy({
      by: ['type'],
      where: {
        ...base,
        type: { in: ['income', 'refund', 'expense'] },
        savings_contribution_id: { not: null },
      },
      _sum: { amount: true },
    }),
  ]);

  return { regular, savings };
};

export const findCategoryRefs = (categoryIds: string[]) =>
  prisma.categories.findMany({
    where: { id: { in: categoryIds } },
    select: categoryRefSelect,
  });
