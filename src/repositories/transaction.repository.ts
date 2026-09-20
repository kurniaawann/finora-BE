import { prisma } from '../config/database.js';
import type { Prisma } from '../generated/prisma/client.js';
import type { transactions_type, transactions_status } from '../generated/prisma/enums.js';

export interface TransactionFilters {
  search?: string;
  type?: transactions_type;
  status?: transactions_status;
  accountId?: string;
  categoryId?: string;
  from?: Date;
  to?: Date;
  minAmount?: number;
  maxAmount?: number;
}

export const createTransaction = async (
  data: Prisma.transactionsCreateInput,
) => {
  return prisma.transactions.create({
    data,
    include: {
      accounts: {
        select: {
          id: true,
          name: true,
          type: true,
          currency: true,
        },
      },
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
  });
};

export const findTransactionsByUser = async (params: {
  userId: string;
  page: number;
  perPage: number;
  filters?: TransactionFilters;
}) => {
  const skip = (params.page - 1) * params.perPage;
  const filters = params.filters ?? {};

  const include = {
    accounts: {
      select: {
        id: true,
        name: true,
        type: true,
        currency: true,
      },
    },
    categories: {
      select: {
        id: true,
        name: true,
        type: true,
        icon: true,
        color: true,
      },
    },
  };

  const conditions: Prisma.transactionsWhereInput[] = [
    {
      user_id: params.userId,
    },
  ];

  if (filters.search) {
    const contains = {
      contains: filters.search,
    };

    conditions.push({
      OR: [
        { description: contains },
        { merchant: contains },
        { reference_number: contains },
      ],
    });
  }

  if (filters.type) {
    conditions.push({ type: filters.type });
  }

  if (filters.status) {
    conditions.push({ status: filters.status });
  }

  if (filters.accountId) {
    conditions.push({ account_id: filters.accountId });
  }

  if (filters.categoryId) {
    conditions.push({ category_id: filters.categoryId });
  }

  if (filters.from || filters.to) {
    conditions.push({
      transaction_date: {
        ...(filters.from ? { gte: filters.from } : {}),
        ...(filters.to ? { lte: filters.to } : {}),
      },
    });
  }

  if (filters.minAmount !== undefined || filters.maxAmount !== undefined) {
    conditions.push({
      amount: {
        ...(filters.minAmount !== undefined
          ? { gte: filters.minAmount }
          : {}),
        ...(filters.maxAmount !== undefined
          ? { lte: filters.maxAmount }
          : {}),
      },
    });
  }

  const where: Prisma.transactionsWhereInput = {
    AND: conditions,
  };

  const [data, total] = await prisma.$transaction([
    prisma.transactions.findMany({
      where,
      orderBy: [
        {
          transaction_date: 'desc',
        },
        {
          created_at: 'desc',
        },
      ],
      skip,
      take: params.perPage,
      include,
    }),

    prisma.transactions.count({
      where,
    }),
  ]);

  return {
    data,
    total,
  };
};

export const findTransactionById = async (
  transactionId: string,
  userId: string,
) => {
  return prisma.transactions.findFirst({
    where: {
      id: transactionId,
      user_id: userId,
    },
    include: {
      accounts: {
        select: {
          id: true,
          name: true,
          type: true,
          currency: true,
        },
      },
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
  });
};

export const updateTransaction = async (
  transactionId: string,
  userId: string,
  data: Prisma.transactionsUpdateInput,
) => {
  return prisma.transactions.update({
    where: {
      id: transactionId,
    },
    data,
  });
};

export const deleteTransaction = async (
  transactionId: string,
  userId: string,
) => {
  return prisma.transactions.deleteMany({
    where: {
      id: transactionId,
      user_id: userId,
    },
  });
};

export const findAccountByIdAndUser = async (
  accountId: string,
  userId: string,
) => {
  return prisma.accounts.findFirst({
    where: {
      id: accountId,
      user_id: userId,
      is_active: true,
    },
  });
};

export const findCategoryByIdAndUser = async (
  categoryId: string,
  userId: string,
) => {
  return prisma.categories.findFirst({
    where: {
      id: categoryId,
      OR: [
        {
          user_id: userId,
        },
        {
          is_system: true,
        },
      ],
    },
  });
};