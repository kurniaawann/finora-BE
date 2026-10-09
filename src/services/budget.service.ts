import { toBudgetDTO } from '../dtos/budget.dto.js';
import {
  type DecimalLike,
  toDateOnly,
  toNumber,
} from '../dtos/common.dto.js';
import { Prisma } from '../generated/prisma/client.js';
import {
  type BudgetDetailRecord,
  type BudgetPeriod,
  createBudget,
  deleteBudget,
  findActiveBudgetsOn,
  findBudgetById,
  findBudgets,
  findUserProfileSettings,
  sumSpending,
  sumSpendingByCategory,
  sumSpendingByDate,
  updateBudget,
} from '../repositories/budget.repository.js';
import { notFound, unprocessable } from '../utils/app-error.js';
import type { PaginationParams } from '../utils/pagination.js';
import type {
  CreateBudgetInput,
  UpdateBudgetInput,
} from '../validators/budget.validator.js';
import { requireUsableCategory } from './ownership.service.js';
import { todayInTimeZone } from '../utils/date.js';

const parseDate = (value: string) => new Date(`${value}T00:00:00.000Z`);

/** Samakan Date apa pun ke tengah malam UTC seperti kolom DATE. */
const toDateValue = (date: Date) => parseDate(toDateOnly(date));

const toCents = (value: DecimalLike) => Math.round(toNumber(value) * 100);

const requireBudget = async (userId: string, budgetId: string) => {
  const budget = await findBudgetById(budgetId, userId);

  if (!budget) {
    throw notFound('BUDGET_NOT_FOUND', 'Anggaran tidak ditemukan');
  }

  return budget;
};

const assertExpenseCategories = async (
  userId: string,
  allocations: { category_id: string }[],
) => {
  const categories = await Promise.all(
    allocations.map((allocation) =>
      requireUsableCategory(allocation.category_id, userId),
    ),
  );

  if (categories.some((category) => category.type !== 'expense')) {
    throw unprocessable(
      'INVALID_CATEGORY_TYPE',
      'Anggaran hanya bisa memakai kategori pengeluaran',
    );
  }
};

const assertAllocationWithinAmount = (
  allocations: { amount: DecimalLike }[],
  amount: DecimalLike,
) => {
  const allocated = allocations.reduce(
    (sum, allocation) => sum + toCents(allocation.amount),
    0,
  );

  if (allocated > toCents(amount)) {
    throw unprocessable(
      'ALLOCATION_EXCEEDS_BUDGET',
      'Total alokasi kategori melebihi total anggaran',
    );
  }
};

/** Hitung `spent` banyak anggaran sekaligus dengan satu query. */
const withSpent = async <
  T extends { start_date: Date; end_date: Date },
>(
  userId: string,
  budgets: T[],
) => {
  if (budgets.length === 0) {
    return [];
  }

  const from = new Date(
    Math.min(...budgets.map((budget) => budget.start_date.getTime())),
  );
  const to = new Date(
    Math.max(...budgets.map((budget) => budget.end_date.getTime())),
  );
  const daily = await sumSpendingByDate(userId, from, to);

  return budgets.map((budget) => ({
    budget,
    spent: daily.reduce(
      (sum, row) =>
        row.date >= budget.start_date && row.date <= budget.end_date
          ? sum.add(row.amount)
          : sum,
      new Prisma.Decimal(0),
    ),
  }));
};

const withDetailSpent = async (
  userId: string,
  budget: BudgetDetailRecord,
) => {
  const [spent, spentByCategory] = await Promise.all([
    sumSpending(userId, budget.start_date, budget.end_date),
    sumSpendingByCategory(
      userId,
      budget.budget_categories.map((allocation) => allocation.category_id),
      budget.start_date,
      budget.end_date,
    ),
  ]);

  return { budget, spent, spentByCategory };
};

export const listBudgets = async (
  userId: string,
  pagination: PaginationParams,
  filters: { search?: string; isActive?: boolean; period?: BudgetPeriod },
) => {
  const today = filters.period
    ? todayInTimeZone((await findUserProfileSettings(userId))?.timezone)
    : undefined;

  const result = await findBudgets(userId, pagination, { ...filters, today });

  return {
    data: await withSpent(userId, result.data),
    total: result.total,
  };
};

export const getBudget = async (userId: string, budgetId: string) =>
  withDetailSpent(userId, await requireBudget(userId, budgetId));

/**
 * Ringkasan anggaran aktif yang rentangnya mencakup `date` (dibaca
 * sebagai tanggal UTC, mis. hasil `new Date('2026-10-01')`).
 */
export const getActiveBudgetsSummary = async (userId: string, date: Date) => {
  const budgets = await findActiveBudgetsOn(userId, toDateValue(date));
  const items = await withSpent(userId, budgets);

  return items.map(({ budget, spent }) => toBudgetDTO(budget, spent));
};

export const addBudget = async (userId: string, input: CreateBudgetInput) => {
  const categories = input.categories ?? [];

  await assertExpenseCategories(userId, categories);
  assertAllocationWithinAmount(categories, input.amount);

  const budget = await createBudget({
    userId,
    name: input.name,
    amount: input.amount,
    startDate: parseDate(input.start_date),
    endDate: parseDate(input.end_date),
    isActive: input.is_active ?? true,
    categories,
  });

  return withDetailSpent(userId, budget);
};

/** `categories` bila dikirim menggantikan seluruh alokasi lama. */
export const editBudget = async (
  userId: string,
  budgetId: string,
  input: UpdateBudgetInput,
) => {
  const budget = await requireBudget(userId, budgetId);

  const startDate = input.start_date
    ? parseDate(input.start_date)
    : budget.start_date;
  const endDate = input.end_date ? parseDate(input.end_date) : budget.end_date;

  if (endDate < startDate) {
    throw unprocessable(
      'INVALID_DATE_RANGE',
      'Tanggal selesai tidak boleh sebelum tanggal mulai',
    );
  }

  if (input.categories) {
    await assertExpenseCategories(userId, input.categories);
  }

  assertAllocationWithinAmount(
    input.categories ?? budget.budget_categories,
    input.amount ?? budget.amount,
  );

  const updated = await updateBudget(budgetId, {
    name: input.name,
    amount: input.amount,
    start_date: input.start_date ? startDate : undefined,
    end_date: input.end_date ? endDate : undefined,
    is_active: input.is_active,
    budget_categories: input.categories && {
      deleteMany: {},
      create: input.categories,
    },
  });

  return withDetailSpent(userId, updated);
};

export const removeBudget = async (userId: string, budgetId: string) => {
  const result = await deleteBudget(budgetId, userId);

  if (result.count === 0) {
    throw notFound('BUDGET_NOT_FOUND', 'Anggaran tidak ditemukan');
  }
};
