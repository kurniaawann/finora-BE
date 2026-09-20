import { prisma } from '../config/database.js';
import type { Prisma } from '../generated/prisma/client.js';
import type { payment_methods_type } from '../generated/prisma/enums.js';

const includeAccount = {
  accounts: {
    select: {
      id: true,
      name: true,
    },
  },
};

export const clearDefaultPaymentMethods = async (
  userId: string,
  db: Prisma.TransactionClient = prisma,
) => {
  return db.payment_methods.updateMany({
    where: {
      user_id: userId,
      is_default: true,
    },
    data: {
      is_default: false,
    },
  });
};

export const createPaymentMethod = async (
  data: {
    userId: string;
    name: string;
    type: payment_methods_type;
    provider: string | null;
    accountId: string | null;
    isDefault: boolean;
  },
  db: Prisma.TransactionClient = prisma,
) => {
  return db.payment_methods.create({
    data: {
      user_id: data.userId,
      name: data.name,
      type: data.type,
      provider: data.provider,
      account_id: data.accountId,
      is_default: data.isDefault,
    },
    include: includeAccount,
  });
};

export const findPaymentMethodsByUser = async (params: {
  userId: string;
  page: number;
  perPage: number;
  type?: payment_methods_type;
  search?: string;
  isActive?: boolean;
  isDefault?: boolean;
}) => {
  const skip = (params.page - 1) * params.perPage;

  const where: Prisma.payment_methodsWhereInput = {
    user_id: params.userId,
    is_active: params.isActive ?? true,
  };

  if (params.type) {
    where.type = params.type;
  }

  if (params.search) {
    const contains = {
      contains: params.search,
    };

    where.OR = [
      { name: contains },
      { provider: contains },
    ];
  }

  if (params.isDefault !== undefined) {
    where.is_default = params.isDefault;
  }

  const [data, total] = await prisma.$transaction([
    prisma.payment_methods.findMany({
      where,
      orderBy: [
        {
          is_default: 'desc',
        },
        {
          name: 'asc',
        },
      ],
      skip,
      take: params.perPage,
      include: includeAccount,
    }),

    prisma.payment_methods.count({
      where,
    }),
  ]);

  return {
    data,
    total,
    page: params.page,
    perPage: params.perPage,
  };
};

export const findPaymentMethodByIdAndUser = async (
  methodId: string,
  userId: string,
) => {
  return prisma.payment_methods.findFirst({
    where: {
      id: methodId,
      user_id: userId,
    },
    include: includeAccount,
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

export const updatePaymentMethod = async (
  methodId: string,
  userId: string,
  data: {
    name?: string;
    type?: payment_methods_type;
    provider?: string | null;
    account_id?: string | null;
    is_default?: boolean;
    is_active?: boolean;
  },
  db: Prisma.TransactionClient = prisma,
) => {
  return db.payment_methods.updateMany({
    where: {
      id: methodId,
      user_id: userId,
    },
    data,
  });
};

export const deactivatePaymentMethod = async (
  methodId: string,
  userId: string,
  db: Prisma.TransactionClient = prisma,
) => {
  return db.payment_methods.updateMany({
    where: {
      id: methodId,
      user_id: userId,
    },
    data: {
      is_active: false,
      is_default: false,
    },
  });
};