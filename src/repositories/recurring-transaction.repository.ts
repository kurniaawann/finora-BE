import { prisma } from '../config/database.js';
import {
  accountRefSelect,
  categoryRefSelect,
} from '../dtos/common.dto.js';
import type { Prisma } from '../generated/prisma/client.js';
import type {
  recurring_transactions_frequency,
  recurring_transactions_type,
} from '../generated/prisma/enums.js';
import type { PaginationParams } from '../utils/pagination.js';

type Db = Prisma.TransactionClient;

const recurringInclude = {
  accounts: { select: accountRefSelect },
  categories: { select: categoryRefSelect },
} satisfies Prisma.recurring_transactionsInclude;

export interface RecurringFilters {
  search?: string;
  type?: recurring_transactions_type;
  frequency?: recurring_transactions_frequency;
  isActive?: boolean;
  accountId?: string;
  categoryId?: string;
  from?: Date;
  to?: Date;
}

export const findRecurringTransactions = async (
  userId: string,
  { page, perPage }: PaginationParams,
  filters: RecurringFilters,
) => {
  const where: Prisma.recurring_transactionsWhereInput = {
    user_id: userId,
    ...(filters.type && { type: filters.type }),
    ...(filters.frequency && { frequency: filters.frequency }),
    ...(filters.isActive !== undefined && { is_active: filters.isActive }),
    ...(filters.accountId && { account_id: filters.accountId }),
    ...(filters.categoryId && { category_id: filters.categoryId }),
    ...((filters.from || filters.to) && {
      next_run_date: { gte: filters.from, lte: filters.to },
    }),
    ...(filters.search && {
      OR: [
        { name: { contains: filters.search } },
        { description: { contains: filters.search } },
      ],
    }),
  };

  const [data, total] = await prisma.$transaction([
    prisma.recurring_transactions.findMany({
      where,
      orderBy: [
        { is_active: 'desc' },
        { next_run_date: 'asc' },
        { name: 'asc' },
      ],
      skip: (page - 1) * perPage,
      take: perPage,
      include: recurringInclude,
    }),
    prisma.recurring_transactions.count({ where }),
  ]);

  return { data, total };
};

export const findRecurringTransactionById = (
  recurringId: string,
  userId: string,
) =>
  prisma.recurring_transactions.findFirst({
    where: { id: recurringId, user_id: userId },
    include: recurringInclude,
  });

export const createRecurringTransaction = (
  data: Prisma.recurring_transactionsUncheckedCreateInput,
) =>
  prisma.recurring_transactions.create({
    data,
    include: recurringInclude,
  });

export const updateRecurringTransaction = (
  recurringId: string,
  data: Prisma.recurring_transactionsUncheckedUpdateInput,
) =>
  prisma.recurring_transactions.update({
    where: { id: recurringId },
    data,
    include: recurringInclude,
  });

export const deleteRecurringTransaction = (
  recurringId: string,
  userId: string,
) =>
  prisma.recurring_transactions.deleteMany({
    where: { id: recurringId, user_id: userId },
  });

export const findUserTimeZone = async (userId: string) =>
  (
    await prisma.profile.findUnique({
      where: { user_id: userId },
      select: { timezone: true },
    })
  )?.timezone;

/* ------------------------------------------------------------------ */
/* Eksekusi jadwal                                                     */
/* ------------------------------------------------------------------ */

/**
 * Transaksi berulang aktif yang jadwalnya ≤ `until`, diurutkan per id
 * agar bisa diambil bertahap (`afterId`).
 */
export const findDueRecurringTransactions = (
  until: Date,
  take: number,
  afterId?: string,
) =>
  prisma.recurring_transactions.findMany({
    where: {
      is_active: true,
      type: { in: ['income', 'expense'] },
      next_run_date: { lte: until },
      ...(afterId && { id: { gt: afterId } }),
    },
    orderBy: { id: 'asc' },
    take,
    select: {
      id: true,
      user_id: true,
      account_id: true,
      category_id: true,
      type: true,
      name: true,
      amount: true,
      frequency: true,
      start_date: true,
      end_date: true,
      next_run_date: true,
      description: true,
      accounts: { select: { is_active: true, currency: true } },
      users: { select: { profiles: { select: { timezone: true } } } },
    },
  });

/**
 * Majukan jadwal hanya bila `next_run_date` masih sama dengan yang
 * dibaca (optimistic concurrency). `count` 0 berarti sudah diproses
 * proses lain.
 */
export const advanceRecurringSchedule = (
  recurringId: string,
  expectedNextRunDate: Date,
  data: { next_run_date: Date; is_active: boolean },
  db: Db,
) =>
  db.recurring_transactions.updateMany({
    where: {
      id: recurringId,
      is_active: true,
      next_run_date: expectedNextRunDate,
    },
    data,
  });

export const createRecurringEntry = (
  data: Prisma.transactionsUncheckedCreateInput,
  db: Db,
) =>
  db.transactions.create({
    data,
    select: {
      id: true,
      type: true,
      status: true,
      amount: true,
      transaction_date: true,
      description: true,
      merchant: true,
      reference_number: true,
    },
  });
