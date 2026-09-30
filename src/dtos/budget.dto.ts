import { Prisma } from '../generated/prisma/client.js';
import {
  type CategoryRefDTO,
  type DecimalLike,
  toCategoryRef,
  toDateOnly,
  toMoney,
  toNumber,
  toPercentage,
} from './common.dto.js';

export type BudgetStatus = 'safe' | 'warning' | 'exceeded';

export const BUDGET_WARNING_PERCENTAGE = 80;
export const BUDGET_EXCEEDED_PERCENTAGE = 100;

const toDecimal = (value: DecimalLike) =>
  new Prisma.Decimal(value.toString());

/** true bila pemakaian sudah mencapai `percentage` persen dari batas. */
export const hasReachedPercentage = (
  spent: DecimalLike,
  limit: DecimalLike,
  percentage: number,
): boolean => {
  const limitValue = toDecimal(limit);

  return (
    limitValue.gt(0) &&
    toDecimal(spent).mul(100).gte(limitValue.mul(percentage))
  );
};

export const getBudgetStatus = (
  spent: DecimalLike,
  limit: DecimalLike,
): BudgetStatus => {
  if (hasReachedPercentage(spent, limit, BUDGET_EXCEEDED_PERCENTAGE)) {
    return 'exceeded';
  }

  if (hasReachedPercentage(spent, limit, BUDGET_WARNING_PERCENTAGE)) {
    return 'warning';
  }

  return 'safe';
};

/** `remaining` boleh negatif: nilai minus = kelebihan pengeluaran. */
const toUsage = (limit: DecimalLike, spent: DecimalLike) => ({
  spent: toMoney(spent),
  remaining: toMoney(toDecimal(limit).sub(toDecimal(spent))),
  progress_percentage: toPercentage(toNumber(spent), toNumber(limit)),
  status: getBudgetStatus(spent, limit),
});

export interface BudgetDTO {
  id: string;
  name: string;
  amount: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
  spent: string;
  remaining: string;
  progress_percentage: number;
  status: BudgetStatus;
}

export interface BudgetCategoryDTO {
  category: CategoryRefDTO;
  amount: string;
  spent: string;
  remaining: string;
  progress_percentage: number;
  status: BudgetStatus;
}

export interface BudgetDetailDTO extends BudgetDTO {
  total_allocated: string;
  unallocated: string;
  categories: BudgetCategoryDTO[];
}

type BudgetSource = {
  id: string;
  name: string;
  amount: DecimalLike;
  start_date: Date;
  end_date: Date;
  is_active: boolean;
};

type BudgetDetailSource = BudgetSource & {
  budget_categories: {
    category_id: string;
    amount: DecimalLike;
    categories: CategoryRefDTO;
  }[];
};

export const toBudgetDTO = (
  budget: BudgetSource,
  spent: DecimalLike,
): BudgetDTO => ({
  id: budget.id,
  name: budget.name,
  amount: toMoney(budget.amount),
  start_date: toDateOnly(budget.start_date),
  end_date: toDateOnly(budget.end_date),
  is_active: budget.is_active,
  ...toUsage(budget.amount, spent),
});

export const toBudgetDetailDTO = (
  budget: BudgetDetailSource,
  spent: DecimalLike,
  spentByCategory: Map<string, DecimalLike>,
): BudgetDetailDTO => {
  const totalAllocated = budget.budget_categories.reduce(
    (sum, allocation) => sum.add(toDecimal(allocation.amount)),
    new Prisma.Decimal(0),
  );

  return {
    ...toBudgetDTO(budget, spent),
    total_allocated: toMoney(totalAllocated),
    unallocated: toMoney(toDecimal(budget.amount).sub(totalAllocated)),
    categories: budget.budget_categories.map((allocation) => ({
      category: toCategoryRef(allocation.categories),
      amount: toMoney(allocation.amount),
      ...toUsage(
        allocation.amount,
        spentByCategory.get(allocation.category_id) ?? 0,
      ),
    })),
  };
};
