type Amount = { toString(): string };

export interface BudgetCategoryRefDTO {
  id: string;
  name: string;
  type: string;
  icon: string | null;
  color: string | null;
}

export interface BudgetCategoryDTO {
  id: string;
  category_id: string;
  category: BudgetCategoryRefDTO | null;
  amount: string;
  spent: string;
  remaining: string;
  progress_percentage: number;
}

export interface BudgetSummaryDTO {
  id: string;
  name: string;
  amount: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
  total_allocated: string;
  unallocated: string;
  spent: string;
  remaining: string;
  progress_percentage: number;
  created_at: string;
  updated_at: string;
}

export interface BudgetDTO extends BudgetSummaryDTO {
  categories: BudgetCategoryDTO[];
}

const toNumber = (
  value: Amount | number | null | undefined,
): number => {
  if (value === null || value === undefined) {
    return 0;
  }

  return Number(value.toString());
};

const toMoney = (value: number): string =>
  value.toFixed(2);

const toPercentage = (
  part: number,
  whole: number,
): number => {
  if (whole <= 0) {
    return 0;
  }

  return Math.round((part / whole) * 10000) / 100;
};

const toDateOnly = (
  value: Date | string,
): string => new Date(value).toISOString().slice(0, 10);

const toIsoDateTime = (
  value: Date | string,
): string => new Date(value).toISOString();

type BudgetInput = {
  id: string;
  name: string;
  amount: Amount;
  start_date: Date | string;
  end_date: Date | string;
  is_active: boolean;
  created_at: Date | string;
  updated_at: Date | string;
  budget_categories: {
    id: string;
    category_id: string;
    amount: Amount;
    categories?: BudgetCategoryRefDTO | null;
  }[];
};

const computeSummary = (
  budget: BudgetInput,
  spentByCategory: Map<
    string,
    Amount | number
  > = new Map(),
) => {
  const amount = toNumber(budget.amount);

  const categories: BudgetCategoryDTO[] =
    budget.budget_categories.map(
      (budgetCategory) => {
        const allocated = toNumber(
          budgetCategory.amount,
        );
        const spent = toNumber(
          spentByCategory.get(
            budgetCategory.category_id,
          ),
        );

        return {
          id: budgetCategory.id,
          category_id:
            budgetCategory.category_id,
          category:
            budgetCategory.categories ?? null,
          amount: toMoney(allocated),
          spent: toMoney(spent),
          remaining: toMoney(allocated - spent),
          progress_percentage: toPercentage(
            spent,
            allocated,
          ),
        };
      },
    );

  const totalAllocated = categories.reduce(
    (sum, category) =>
      sum + Number(category.amount),
    0,
  );

  const spent = categories.reduce(
    (sum, category) =>
      sum + Number(category.spent),
    0,
  );

  return {
    amount: toMoney(amount),
    total_allocated: toMoney(totalAllocated),
    unallocated: toMoney(amount - totalAllocated),
    spent: toMoney(spent),
    remaining: toMoney(amount - spent),
    progress_percentage: toPercentage(
      spent,
      amount,
    ),
    categories,
  };
};

export const toBudgetSummaryDTO = (
  budget: BudgetInput,
  spentByCategory: Map<
    string,
    Amount | number
  > = new Map(),
): BudgetSummaryDTO => {
  const summary = computeSummary(
    budget,
    spentByCategory,
  );

  return {
    id: budget.id,
    name: budget.name,
    amount: summary.amount,
    start_date: toDateOnly(budget.start_date),
    end_date: toDateOnly(budget.end_date),
    is_active: budget.is_active,
    total_allocated: summary.total_allocated,
    unallocated: summary.unallocated,
    spent: summary.spent,
    remaining: summary.remaining,
    progress_percentage:
      summary.progress_percentage,
    created_at: toIsoDateTime(budget.created_at),
    updated_at: toIsoDateTime(budget.updated_at),
  };
};

export const toBudgetDTO = (
  budget: BudgetInput,
  spentByCategory: Map<
    string,
    Amount | number
  > = new Map(),
): BudgetDTO => {
  const summary = computeSummary(
    budget,
    spentByCategory,
  );

  return {
    id: budget.id,
    name: budget.name,
    amount: summary.amount,
    start_date: toDateOnly(budget.start_date),
    end_date: toDateOnly(budget.end_date),
    is_active: budget.is_active,
    total_allocated: summary.total_allocated,
    unallocated: summary.unallocated,
    spent: summary.spent,
    remaining: summary.remaining,
    progress_percentage:
      summary.progress_percentage,
    categories: summary.categories,
    created_at: toIsoDateTime(budget.created_at),
    updated_at: toIsoDateTime(budget.updated_at),
  };
};
