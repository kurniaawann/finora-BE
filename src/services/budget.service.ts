import {
  createBudget,
  deleteBudget,
  findBudgetByIdAndUser,
  findBudgetsByUser,
  findCategoriesByIdsForUser,
  sumExpenseByCategory,
  updateBudget,
} from '../repositories/budget.repository.js';

import type { BudgetFilters } from '../repositories/budget.repository.js';

import type {
  CreateBudgetInput,
  UpdateBudgetInput,
} from '../validators/budget.validator.js';

import { Prisma } from '../generated/prisma/client.js';

type BudgetWithCategories = NonNullable<
  Awaited<ReturnType<typeof findBudgetByIdAndUser>>
>;

const ALLOCATION_EPSILON = 0.005;

const toDate = (value: string): Date =>
  new Date(`${value}T00:00:00.000Z`);

const assertDateRange = (
  startDate: Date,
  endDate: Date,
) => {
  if (startDate.getTime() > endDate.getTime()) {
    throw new Error('INVALID_DATE_RANGE');
  }
};

const assertCategories = async (
  userId: string,
  categories: { category_id: string }[],
) => {
  if (categories.length === 0) {
    return;
  }

  const ids = [
    ...new Set(
      categories.map(
        (category) => category.category_id,
      ),
    ),
  ];

  const found = await findCategoriesByIdsForUser(
    userId,
    ids,
  );

  if (found.length !== ids.length) {
    throw new Error('CATEGORY_NOT_FOUND');
  }

  // Budget hanya untuk kategori pengeluaran.
  if (found.some((category) => category.type !== 'expense')) {
    throw new Error('INVALID_CATEGORY_TYPE');
  }
};

const assertAllocationWithinAmount = (
  categories: { amount: number }[],
  amount: number,
) => {
  const total = categories.reduce(
    (sum, category) => sum + category.amount,
    0,
  );

  if (total - amount > ALLOCATION_EPSILON) {
    throw new Error('ALLOCATION_EXCEEDS_BUDGET');
  }
};

const getSpentByCategory = async (
  userId: string,
  budget: {
    start_date: Date;
    end_date: Date;
    budget_categories: { category_id: string }[];
  },
) => {
  const categoryIds = budget.budget_categories.map(
    (budgetCategory) => budgetCategory.category_id,
  );

  const rows = await sumExpenseByCategory({
    userId,
    categoryIds,
    from: budget.start_date,
    to: budget.end_date,
  });

  const spentByCategory = new Map<
    string,
    Prisma.Decimal
  >();

  for (const row of rows) {
    if (!row.category_id) {
      continue;
    }

    spentByCategory.set(
      row.category_id,
      row._sum.amount ?? new Prisma.Decimal(0),
    );
  }

  return spentByCategory;
};

const getSpentForBudgets = async (
  userId: string,
  budgets: {
    id: string;
    start_date: Date;
    end_date: Date;
    budget_categories: { category_id: string }[];
  }[],
) => {
  const spentMap = new Map<
    string,
    Map<string, Prisma.Decimal>
  >();

  await Promise.all(
    budgets.map(async (budget) => {
      const spent = await getSpentByCategory(
        userId,
        budget,
      );
      spentMap.set(budget.id, spent);
    }),
  );

  return spentMap;
};

export const create = async (
  userId: string,
  input: CreateBudgetInput,
) => {
  const startDate = toDate(input.start_date);
  const endDate = toDate(input.end_date);

  assertDateRange(startDate, endDate);

  const categories = input.categories ?? [];

  await assertCategories(userId, categories);
  assertAllocationWithinAmount(
    categories,
    input.amount,
  );

  return createBudget({
    userId,
    name: input.name,
    amount: input.amount,
    startDate,
    endDate,
    isActive: input.is_active ?? true,
    categories: categories.map((category) => ({
      categoryId: category.category_id,
      amount: category.amount,
    })),
  });
};

export const getAll = async (
  userId: string,
  page: number,
  perPage: number,
  filters: BudgetFilters = {},
) => {
  const result = await findBudgetsByUser({
    userId,
    page,
    perPage,
    filters,
  });

  const spentMap = await getSpentForBudgets(
    userId,
    result.data,
  );

  return {
    data: result.data,
    total: result.total,
    spentMap,
  };
};

export const getById = async (
  userId: string,
  budgetId: string,
) => {
  const budget = await findBudgetByIdAndUser(
    budgetId,
    userId,
  );

  if (!budget) {
    throw new Error('BUDGET_NOT_FOUND');
  }

  const spentByCategory = await getSpentByCategory(
    userId,
    budget,
  );

  return {
    budget,
    spentByCategory,
  };
};

export const update = async (
  userId: string,
  budgetId: string,
  input: UpdateBudgetInput,
) => {
  const budget = await findBudgetByIdAndUser(
    budgetId,
    userId,
  );

  if (!budget) {
    throw new Error('BUDGET_NOT_FOUND');
  }

  const startDate =
    input.start_date !== undefined
      ? toDate(input.start_date)
      : budget.start_date;

  const endDate =
    input.end_date !== undefined
      ? toDate(input.end_date)
      : budget.end_date;

  assertDateRange(startDate, endDate);

  const effectiveAmount =
    input.amount ?? Number(budget.amount.toString());

  if (input.categories !== undefined) {
    await assertCategories(userId, input.categories);
    assertAllocationWithinAmount(
      input.categories,
      effectiveAmount,
    );
  } else if (input.amount !== undefined) {
    const existing = budget.budget_categories.map(
      (budgetCategory) => ({
        amount: Number(
          budgetCategory.amount.toString(),
        ),
      }),
    );

    assertAllocationWithinAmount(
      existing,
      effectiveAmount,
    );
  }

  const data: Prisma.budgetsUpdateInput = {};

  if (input.name !== undefined) {
    data.name = input.name;
  }

  if (input.amount !== undefined) {
    data.amount = input.amount;
  }

  if (input.start_date !== undefined) {
    data.start_date = startDate;
  }

  if (input.end_date !== undefined) {
    data.end_date = endDate;
  }

  if (input.is_active !== undefined) {
    data.is_active = input.is_active;
  }

  if (input.categories !== undefined) {
    data.budget_categories = {
      deleteMany: {},
      create: input.categories.map(
        (category) => ({
          category_id: category.category_id,
          amount: category.amount,
        }),
      ),
    };
  }

  const updated = await updateBudget(
    budgetId,
    data,
  );

  const spentByCategory = await getSpentByCategory(
    userId,
    updated,
  );

  return {
    budget: updated,
    spentByCategory,
  };
};

export const remove = async (
  userId: string,
  budgetId: string,
) => {
  const budget = await findBudgetByIdAndUser(
    budgetId,
    userId,
  );

  if (!budget) {
    throw new Error('BUDGET_NOT_FOUND');
  }

  const result = await deleteBudget(
    budgetId,
    userId,
  );

  if (result.count === 0) {
    throw new Error('BUDGET_NOT_FOUND');
  }

  return true;
};
