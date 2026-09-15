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
) => {
  return prisma.accounts.findMany({
    where: {
      user_id: userId,
    },
    orderBy: {
      created_at: 'desc',
    },
  });
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