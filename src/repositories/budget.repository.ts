import { prisma } from '../config/database.js';
import { Prisma } from '../generated/prisma/client.js';

export interface BudgetFilters {
  search?: string;
  isActive?: boolean;
  categoryId?: string;
  from?: Date;
  to?: Date;
}

const budgetInclude = {
  budget_categories: {
    include: {
      categories: {
        select: {
          id: true,
          name: true,
          type: true,
          icon: true,
          color: true,
        },
      },
    },
  },
} satisfies Prisma.budgetsInclude;

export const createBudget = async (data: {
  userId: string;
  name: string;
  amount: number;
  startDate: Date;
  endDate: Date;
  isActive: boolean;
  categories: {
    categoryId: string;
    amount: number;
  }[];
}) => {
  return prisma.budgets.create({
    data: {
      user_id: data.userId,
      name: data.name,
      amount: data.amount,
      start_date: data.startDate,
      end_date: data.endDate,
      is_active: data.isActive,

      ...(data.categories.length > 0
        ? {
            budget_categories: {
              create: data.categories.map(
                (category) => ({
                  category_id: category.categoryId,
                  amount: category.amount,
                }),
              ),
            },
          }
        : {}),
    },
    include: budgetInclude,
  });
};

export const findBudgetsByUser = async (params: {
  userId: string;
  page: number;
  perPage: number;
  filters?: BudgetFilters;
}) => {
  const skip =
    (params.page - 1) * params.perPage;
  const filters = params.filters ?? {};

  const conditions: Prisma.budgetsWhereInput[] = [
    {
      user_id: params.userId,
    },
  ];

  if (filters.search) {
    conditions.push({
      name: {
        contains: filters.search,
      },
    });
  }

  if (filters.isActive !== undefined) {
    conditions.push({
      is_active: filters.isActive,
    });
  }

  if (filters.categoryId) {
    conditions.push({
      budget_categories: {
        some: {
          category_id: filters.categoryId,
        },
      },
    });
  }

  if (filters.from) {
    conditions.push({
      end_date: {
        gte: filters.from,
      },
    });
  }

  if (filters.to) {
    conditions.push({
      start_date: {
        lte: filters.to,
      },
    });
  }

  const where: Prisma.budgetsWhereInput = {
    AND: conditions,
  };

  const [data, total] = await prisma.$transaction([
    prisma.budgets.findMany({
      where,
      orderBy: [
        {
          start_date: 'desc',
        },
        {
          created_at: 'desc',
        },
      ],
      skip,
      take: params.perPage,
      include: budgetInclude,
    }),

    prisma.budgets.count({
      where,
    }),
  ]);

  return {
    data,
    total,
  };
};

export const findBudgetByIdAndUser = async (
  budgetId: string,
  userId: string,
) => {
  return prisma.budgets.findFirst({
    where: {
      id: budgetId,
      user_id: userId,
    },
    include: budgetInclude,
  });
};

export const updateBudget = async (
  budgetId: string,
  data: Prisma.budgetsUpdateInput,
) => {
  return prisma.budgets.update({
    where: {
      id: budgetId,
    },
    data,
    include: budgetInclude,
  });
};

export const deleteBudget = async (
  budgetId: string,
  userId: string,
) => {
  return prisma.budgets.deleteMany({
    where: {
      id: budgetId,
      user_id: userId,
    },
  });
};

export const findCategoriesByIdsForUser = async (
  userId: string,
  categoryIds: string[],
) => {
  return prisma.categories.findMany({
    where: {
      id: {
        in: categoryIds,
      },
      OR: [
        {
          user_id: userId,
        },
        {
          is_system: true,
        },
      ],
    },
    select: {
      id: true,
      name: true,
      type: true,
      icon: true,
      color: true,
    },
  });
};

export const sumExpenseByCategory = async (params: {
  userId: string;
  categoryIds: string[];
  from: Date;
  to: Date;
}) => {
  if (params.categoryIds.length === 0) {
    return [];
  }

  return prisma.transactions.groupBy({
    by: ['category_id'],
    where: {
      user_id: params.userId,
      type: 'expense',
      status: 'completed',
      category_id: {
        in: params.categoryIds,
      },
      transaction_date: {
        gte: params.from,
        lte: params.to,
      },
    },
    _sum: {
      amount: true,
    },
  });
};
