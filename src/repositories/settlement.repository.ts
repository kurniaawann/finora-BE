import { prisma } from '../config/database.js';
import {
  accountRefSelect,
  groupRefSelect,
  paymentMethodRefSelect,
  userRefSelect,
} from '../dtos/common.dto.js';
import type { Prisma } from '../generated/prisma/client.js';
import type {
  settlements_status,
  transactions_type,
} from '../generated/prisma/enums.js';
import type { PaginationParams } from '../utils/pagination.js';
import type { Db } from './expense.repository.js';

const settlementSelect = {
  id: true,
  group_id: true,
  from_user_id: true,
  to_user_id: true,
  account_id: true,
  amount: true,
  status: true,
  note: true,
  proof_url: true,
  settled_at: true,
  created_at: true,
  groups: { select: groupRefSelect },
  users_settlements_from_user_idTousers: { select: userRefSelect },
  users_settlements_to_user_idTousers: { select: userRefSelect },
  accounts: { select: accountRefSelect },
  payment_methods: { select: paymentMethodRefSelect },
} satisfies Prisma.settlementsSelect;

export type SettlementRow = Prisma.settlementsGetPayload<{
  select: typeof settlementSelect;
}>;

export interface SettlementListFilters {
  status?: settlements_status;
  fromUserId?: string;
  toUserId?: string;
  involvingUserId?: string;
  from?: Date;
  to?: Date;
  minAmount?: number;
  maxAmount?: number;
}

export const findSettlementById = (id: string) =>
  prisma.settlements.findUnique({ where: { id }, select: settlementSelect });

export const findGroupSettlements = async (params: {
  groupId: string;
  pagination: PaginationParams;
  filters: SettlementListFilters;
}) => {
  const { filters, pagination } = params;
  const where: Prisma.settlementsWhereInput = {
    group_id: params.groupId,
    status: filters.status,
    from_user_id: filters.fromUserId,
    to_user_id: filters.toUserId,
  };

  if (filters.involvingUserId) {
    where.OR = [
      { from_user_id: filters.involvingUserId },
      { to_user_id: filters.involvingUserId },
    ];
  }

  if (filters.from || filters.to) {
    where.created_at = { gte: filters.from, lte: filters.to };
  }

  if (filters.minAmount !== undefined || filters.maxAmount !== undefined) {
    where.amount = { gte: filters.minAmount, lte: filters.maxAmount };
  }

  const [items, total] = await prisma.$transaction([
    prisma.settlements.findMany({
      where,
      orderBy: [{ created_at: 'desc' }, { id: 'asc' }],
      skip: (pagination.page - 1) * pagination.perPage,
      take: pagination.perPage,
      select: settlementSelect,
    }),
    prisma.settlements.count({ where }),
  ]);

  return { items, total };
};

export const createSettlement = (data: {
  groupId: string;
  fromUserId: string;
  toUserId: string;
  accountId: string | null;
  paymentMethodId: string | null;
  amount: string;
  note: string | null;
}) =>
  prisma.settlements.create({
    data: {
      group_id: data.groupId,
      from_user_id: data.fromUserId,
      to_user_id: data.toUserId,
      account_id: data.accountId,
      payment_method_id: data.paymentMethodId,
      amount: data.amount,
      note: data.note,
      status: 'pending',
    },
    select: { id: true },
  });

/** Ubah pelunasan hanya bila statusnya masih salah satu dari `from`. */
export const updateSettlementIfStatus = async (
  id: string,
  from: settlements_status[],
  data: Prisma.settlementsUncheckedUpdateManyInput,
  db: Db = prisma,
) => {
  const result = await db.settlements.updateMany({
    where: { id, status: { in: from } },
    data,
  });

  return result.count === 1;
};

export const deleteSettlementIfStatus = async (
  id: string,
  from: settlements_status[],
) => {
  const result = await prisma.settlements.deleteMany({
    where: { id, status: { in: from } },
  });

  return result.count === 1;
};

export const createSettlementTransaction = (
  db: Db,
  data: {
    userId: string;
    accountId: string;
    settlementId: string;
    type: Extract<transactions_type, 'income' | 'expense'>;
    amount: string;
    transactionDate: Date;
    description: string;
  },
) =>
  db.transactions.create({
    data: {
      user_id: data.userId,
      account_id: data.accountId,
      type: data.type,
      status: 'completed',
      amount: data.amount,
      transaction_date: data.transactionDate,
      description: data.description,
      settlement_id: data.settlementId,
    },
    select: { id: true },
  });
