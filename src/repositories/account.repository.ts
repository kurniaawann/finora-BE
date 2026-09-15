import { prisma } from '../config/database.js';
import type { accounts_type } from '../generated/prisma/enums.js';

export const createAccount = async (data: {
  userId: string;
  name: string;
  type: accounts_type;
  initial_balance: number;
  currency: string;
}) => {
  return prisma.accounts.create({
    data: {
      user_id: data.userId,
      name: data.name,
      type: data.type,
      initial_balance: data.initial_balance,
      currency: data.currency,
    },
  });
};

export const findAccountsByUserId = async (
  userId: string,
  page: number,
  perPage: number,
) => {
  const skip = (page - 1) * perPage;

  const [data, total] = await prisma.$transaction([
    prisma.accounts.findMany({
      where: {
        user_id: userId,
      },
      orderBy: {
        created_at: 'desc',
      },
      skip,
      take: perPage,
    }),
    prisma.accounts.count({
      where: {
        user_id: userId,
      },
    }),
  ]);

  return {
    data,
    total,
    page,
    perPage,
  };
};

export const findAccountByIdAndUserId = async (
  accountId: string,
  userId: string,
) => {
  return prisma.accounts.findFirst({
    where: {
      id: accountId,
      user_id: userId,
    },
  });
};

export const updateAccount = async (
  accountId: string,
  userId: string,
  data: {
    name?: string;
    type?: accounts_type;
    currency?: string;
    is_active?: boolean;
  },
) => {
  return prisma.accounts.updateMany({
    where: {
      id: accountId,
      user_id: userId,
    },
    data,
  });
};

export const deleteAccount = async (
  accountId: string,
  userId: string,
) => {
  return prisma.accounts.deleteMany({
    where: {
      id: accountId,
      user_id: userId,
    },
  });
};