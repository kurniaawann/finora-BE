import { prisma } from '../config/database.js';
import { accountRefSelect } from '../dtos/common.dto.js';
import type { Prisma } from '../generated/prisma/client.js';
import type { payment_methods_type } from '../generated/prisma/enums.js';
import type { PaginationParams } from '../utils/pagination.js';

type Db = Prisma.TransactionClient;

const paymentMethodInclude = {
  accounts: { select: accountRefSelect },
} satisfies Prisma.payment_methodsInclude;

export interface PaymentMethodFilters {
  search?: string;
  type?: payment_methods_type;
  isActive?: boolean;
}

export const findPaymentMethods = async (
  userId: string,
  { page, perPage }: PaginationParams,
  filters: PaymentMethodFilters,
) => {
  const where: Prisma.payment_methodsWhereInput = {
    user_id: userId,
    is_active: filters.isActive ?? true,
    ...(filters.type && { type: filters.type }),
    ...(filters.search && {
      OR: [
        { name: { contains: filters.search } },
        { provider: { contains: filters.search } },
      ],
    }),
  };

  const [data, total] = await prisma.$transaction([
    prisma.payment_methods.findMany({
      where,
      orderBy: [{ is_default: 'desc' }, { name: 'asc' }],
      skip: (page - 1) * perPage,
      take: perPage,
      include: paymentMethodInclude,
    }),
    prisma.payment_methods.count({ where }),
  ]);

  return { data, total };
};

export const findPaymentMethodById = (methodId: string, userId: string) =>
  prisma.payment_methods.findFirst({
    where: { id: methodId, user_id: userId },
    include: paymentMethodInclude,
  });

export const countActivePaymentMethods = (userId: string, db: Db) =>
  db.payment_methods.count({
    where: { user_id: userId, is_active: true },
  });

export const clearDefaultPaymentMethods = (
  userId: string,
  db: Db,
  exceptId?: string,
) =>
  db.payment_methods.updateMany({
    where: {
      user_id: userId,
      is_default: true,
      ...(exceptId && { id: { not: exceptId } }),
    },
    data: { is_default: false },
  });

export const createPaymentMethod = (
  data: Prisma.payment_methodsUncheckedCreateInput,
  db: Db,
) =>
  db.payment_methods.create({
    data,
    include: paymentMethodInclude,
  });

export const updatePaymentMethod = (
  methodId: string,
  data: Prisma.payment_methodsUncheckedUpdateInput,
  db: Db,
) =>
  db.payment_methods.update({
    where: { id: methodId },
    data,
    include: paymentMethodInclude,
  });

export const deletePaymentMethod = (methodId: string, db: Db) =>
  db.payment_methods.delete({ where: { id: methodId } });

/** Jumlah catatan pembayaran/pelunasan/setoran yang memakai metode ini. */
export const countPaymentMethodUsage = async (methodId: string, db: Db) => {
  const where = { payment_method_id: methodId };

  const [payments, settlements, contributions] = await Promise.all([
    db.expense_payments.count({ where }),
    db.settlements.count({ where }),
    db.savings_contributions.count({ where }),
  ]);

  return payments + settlements + contributions;
};
