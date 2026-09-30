import { prisma } from '../config/database.js';
import { categoryRefSelect } from '../dtos/common.dto.js';
import { Prisma } from '../generated/prisma/client.js';
import type { PaginationParams } from '../utils/pagination.js';

export type BudgetPeriod = 'current' | 'upcoming' | 'past';

export interface BudgetFilters {
  search?: string;
  isActive?: boolean;
  period?: BudgetPeriod;
  /** Tanggal acuan `period` ("hari ini" menurut zona waktu user). */
  today?: Date;
}

const budgetSelect = {
  id: true,
  name: true,
  amount: true,
  start_date: true,
  end_date: true,
  is_active: true,
} satisfies Prisma.budgetsSelect;

const budgetDetailSelect = {
  ...budgetSelect,
  budget_categories: {
    select: {
      category_id: true,
      amount: true,
      categories: { select: categoryRefSelect },
    },
    orderBy: { created_at: 'asc' },
  },
} satisfies Prisma.budgetsSelect;

export type BudgetDetailRecord = Prisma.budgetsGetPayload<{
  select: typeof budgetDetailSelect;
}>;

const periodWhere = (
  period: BudgetPeriod,
  today: Date,
): Prisma.budgetsWhereInput => {
  switch (period) {
    case 'current':
      return { start_date: { lte: today }, end_date: { gte: today } };
    case 'upcoming':
      return { start_date: { gt: today } };
    case 'past':
      return { end_date: { lt: today } };
  }
};

export const findBudgets = async (
  userId: string,
  { page, perPage }: PaginationParams,
  filters: BudgetFilters,
) => {
  const where: Prisma.budgetsWhereInput = {
    user_id: userId,
    ...(filters.search && { name: { contains: filters.search } }),
    ...(filters.isActive !== undefined && { is_active: filters.isActive }),
    ...(filters.period &&
      filters.today &&
      periodWhere(filters.period, filters.today)),
  };

  const [data, total] = await prisma.$transaction([
    prisma.budgets.findMany({
      where,
      orderBy: [{ start_date: 'desc' }, { created_at: 'desc' }],
      skip: (page - 1) * perPage,
      take: perPage,
      select: budgetSelect,
    }),
    prisma.budgets.count({ where }),
  ]);

  return { data, total };
};

export const findBudgetById = (budgetId: string, userId: string) =>
  prisma.budgets.findFirst({
    where: { id: budgetId, user_id: userId },
    select: budgetDetailSelect,
  });

/** Anggaran aktif yang rentang tanggalnya mencakup `date`. */
export const findActiveBudgetsOn = (userId: string, date: Date) =>
  prisma.budgets.findMany({
    where: {
      user_id: userId,
      is_active: true,
      start_date: { lte: date },
      end_date: { gte: date },
    },
    orderBy: [{ end_date: 'asc' }, { created_at: 'asc' }],
    select: budgetDetailSelect,
  });

export const createBudget = (data: {
  userId: string;
  name: string;
  amount: number;
  startDate: Date;
  endDate: Date;
  isActive: boolean;
  categories: { category_id: string; amount: number }[];
}) =>
  prisma.budgets.create({
    data: {
      user_id: data.userId,
      name: data.name,
      amount: data.amount,
      start_date: data.startDate,
      end_date: data.endDate,
      is_active: data.isActive,
      budget_categories: { create: data.categories },
    },
    select: budgetDetailSelect,
  });

export const updateBudget = (
  budgetId: string,
  data: Prisma.budgetsUpdateInput,
) =>
  prisma.budgets.update({
    where: { id: budgetId },
    data,
    select: budgetDetailSelect,
  });

export const deleteBudget = (budgetId: string, userId: string) =>
  prisma.budgets.deleteMany({
    where: { id: budgetId, user_id: userId },
  });

export const findUserProfileSettings = (userId: string) =>
  prisma.profile.findUnique({
    where: { user_id: userId },
    select: { currency: true, timezone: true },
  });

/* ------------------------------------------------------------------ */
/* Pemakaian anggaran                                                  */
/* ------------------------------------------------------------------ */

/**
 * Pengeluaran yang dihitung ke anggaran: transaksi expense selesai
 * milik user dalam rentang tanggal. Setoran tabungan juga tercatat
 * sebagai expense, tetapi bukan belanja, jadi dikecualikan.
 */
const spendingWhere = (
  userId: string,
  from: Date,
  to: Date,
): Prisma.transactionsWhereInput => ({
  user_id: userId,
  type: 'expense',
  status: 'completed',
  savings_contribution_id: null,
  transaction_date: { gte: from, lte: to },
});

export const sumSpending = async (userId: string, from: Date, to: Date) => {
  const result = await prisma.transactions.aggregate({
    where: spendingWhere(userId, from, to),
    _sum: { amount: true },
  });

  return result._sum.amount ?? new Prisma.Decimal(0);
};

/** Total pengeluaran per tanggal, untuk menghitung banyak anggaran sekaligus. */
export const sumSpendingByDate = async (
  userId: string,
  from: Date,
  to: Date,
) => {
  const rows = await prisma.transactions.groupBy({
    by: ['transaction_date'],
    where: spendingWhere(userId, from, to),
    _sum: { amount: true },
  });

  return rows.map((row) => ({
    date: row.transaction_date,
    amount: row._sum.amount ?? new Prisma.Decimal(0),
  }));
};

export const sumSpendingByCategory = async (
  userId: string,
  categoryIds: string[],
  from: Date,
  to: Date,
) => {
  const spent = new Map<string, Prisma.Decimal>();

  if (categoryIds.length === 0) {
    return spent;
  }

  const rows = await prisma.transactions.groupBy({
    by: ['category_id'],
    where: {
      ...spendingWhere(userId, from, to),
      category_id: { in: categoryIds },
    },
    _sum: { amount: true },
  });

  for (const row of rows) {
    if (row.category_id) {
      spent.set(row.category_id, row._sum.amount ?? new Prisma.Decimal(0));
    }
  }

  return spent;
};

/** Notifikasi peringatan anggaran yang sudah pernah dikirim. */
export const findBudgetAlertNotifications = (
  userId: string,
  budgetIds: string[],
) =>
  prisma.notifications.findMany({
    where: {
      user_id: userId,
      type: 'budget',
      OR: budgetIds.map((budgetId) => ({
        data: { path: '$.budget_id', equals: budgetId },
      })),
    },
    select: { data: true },
  });
