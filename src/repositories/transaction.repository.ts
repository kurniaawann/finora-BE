import { prisma } from '../config/database.js';
import type { Prisma } from '../generated/prisma/client.js';

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

export const findTransactionsByUser = async (
  userId: string,
) => {
  return prisma.transactions.findMany({
    where: {
      user_id: userId,
    },
    orderBy: [
      {
        transaction_date: 'desc',
      },
      {
        created_at: 'desc',
      },
    ],
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