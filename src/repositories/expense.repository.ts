import { prisma } from '../config/database.js';
import {
  accountRefSelect,
  groupRefSelect,
  paymentMethodRefSelect,
  userRefSelect,
} from '../dtos/common.dto.js';
import type { Prisma } from '../generated/prisma/client.js';
import type {
  expense_payments_status,
  expenses_category,
  expenses_split_method,
  expenses_status,
} from '../generated/prisma/enums.js';
import type { PaginationParams } from '../utils/pagination.js';

export type Db = Prisma.TransactionClient | typeof prisma;

/* ------------------------------------------------------------------ */
/* Grup, anggota, acara, user                                          */
/* ------------------------------------------------------------------ */

export const findGroupMembership = (groupId: string, userId: string) =>
  prisma.group_members.findUnique({
    where: { group_id_user_id: { group_id: groupId, user_id: userId } },
    select: { role: true, groups: { select: groupRefSelect } },
  });

/** Dari `userIds`, kembalikan yang merupakan anggota grup. */
export const findGroupMemberIds = async (
  groupId: string,
  userIds: string[],
): Promise<Set<string>> => {
  if (userIds.length === 0) {
    return new Set();
  }

  const rows = await prisma.group_members.findMany({
    where: { group_id: groupId, user_id: { in: userIds } },
    select: { user_id: true },
  });

  return new Set(rows.map((row) => row.user_id));
};

export const findGroupManagerIds = async (groupId: string) => {
  const rows = await prisma.group_members.findMany({
    where: { group_id: groupId, role: { in: ['owner', 'admin'] } },
    select: { user_id: true },
  });

  return rows.map((row) => row.user_id);
};

export const findGroupEvent = (eventId: string, groupId: string) =>
  prisma.events.findFirst({
    where: { id: eventId, group_id: groupId },
    select: { id: true, status: true },
  });

export const findUserNameAndTimezone = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, profiles: { select: { timezone: true } } },
  });

  return {
    name: user?.name ?? 'Anggota',
    timezone: user?.profiles?.timezone ?? 'Asia/Jakarta',
  };
};

/* ------------------------------------------------------------------ */
/* Pengeluaran                                                         */
/* ------------------------------------------------------------------ */

const buildExpenseListSelect = (viewerId: string) =>
  ({
    id: true,
    group_id: true,
    title: true,
    category: true,
    status: true,
    total_amount: true,
    expense_date: true,
    events: { select: { id: true, name: true } },
    users: { select: userRefSelect },
    expense_members: {
      where: { user_id: viewerId },
      select: { amount: true },
    },
    _count: { select: { expense_members: true } },
  }) satisfies Prisma.expensesSelect;

export type ExpenseListRow = Prisma.expensesGetPayload<{
  select: ReturnType<typeof buildExpenseListSelect>;
}>;

const expenseDetailSelect = {
  id: true,
  group_id: true,
  created_by: true,
  title: true,
  description: true,
  category: true,
  status: true,
  split_method: true,
  total_amount: true,
  expense_date: true,
  receipt_url: true,
  event_id: true,
  groups: { select: groupRefSelect },
  events: { select: { id: true, name: true } },
  users: { select: userRefSelect },
  expense_members: {
    orderBy: [{ created_at: 'asc' }, { id: 'asc' }],
    select: {
      user_id: true,
      guest_name: true,
      amount: true,
      percentage: true,
      shares: true,
      is_payer: true,
      users: { select: userRefSelect },
    },
  },
  expense_items: {
    orderBy: [{ created_at: 'asc' }, { id: 'asc' }],
    select: {
      id: true,
      name: true,
      quantity: true,
      unit_price: true,
      total_amount: true,
      expense_item_members: {
        orderBy: [{ created_at: 'asc' }, { id: 'asc' }],
        select: {
          user_id: true,
          guest_name: true,
          quantity: true,
          users: { select: userRefSelect },
        },
      },
    },
  },
  _count: {
    select: { expense_members: true, expense_payments: true },
  },
} satisfies Prisma.expensesSelect;

export type ExpenseDetailRow = Prisma.expensesGetPayload<{
  select: typeof expenseDetailSelect;
}>;

export interface ExpenseListFilters {
  search?: string;
  status?: expenses_status;
  category?: expenses_category;
  eventId?: string;
  createdBy?: string;
  from?: Date;
  to?: Date;
  minAmount?: number;
  maxAmount?: number;
  involvingUserId?: string;
}

export const findGroupExpenses = async (params: {
  groupId: string;
  viewerId: string;
  pagination: PaginationParams;
  filters: ExpenseListFilters;
}) => {
  const { filters, pagination } = params;
  const where: Prisma.expensesWhereInput = {
    group_id: params.groupId,
    status: filters.status,
    category: filters.category,
    event_id: filters.eventId,
    created_by: filters.createdBy,
  };
  const and: Prisma.expensesWhereInput[] = [];

  if (filters.search) {
    and.push({
      OR: [
        { title: { contains: filters.search } },
        { description: { contains: filters.search } },
      ],
    });
  }

  if (filters.from || filters.to) {
    where.expense_date = { gte: filters.from, lte: filters.to };
  }

  if (filters.minAmount !== undefined || filters.maxAmount !== undefined) {
    where.total_amount = { gte: filters.minAmount, lte: filters.maxAmount };
  }

  if (filters.involvingUserId) {
    and.push({
      OR: [
        { expense_members: { some: { user_id: filters.involvingUserId } } },
        {
          expense_payments: {
            some: {
              payer_id: filters.involvingUserId,
              status: { in: ['pending', 'submitted', 'confirmed'] },
            },
          },
        },
      ],
    });
  }

  if (and.length > 0) {
    where.AND = and;
  }

  const [items, total] = await prisma.$transaction([
    prisma.expenses.findMany({
      where,
      orderBy: [{ expense_date: 'desc' }, { created_at: 'desc' }],
      skip: (pagination.page - 1) * pagination.perPage,
      take: pagination.perPage,
      select: buildExpenseListSelect(params.viewerId),
    }),
    prisma.expenses.count({ where }),
  ]);

  return { items, total };
};

export const findExpenseById = (id: string) =>
  prisma.expenses.findUnique({
    where: { id },
    select: expenseDetailSelect,
  });

export interface PaymentTotals {
  confirmedCents: number;
  pendingCents: number;
}

const toCents = (value: { toString(): string } | null | undefined) =>
  value ? Math.round(Number(value.toString()) * 100) : 0;

/** Total pembayaran confirmed & pending/submitted per pengeluaran. */
export const sumPaymentsByExpense = async (
  expenseIds: string[],
  db: Db = prisma,
): Promise<Map<string, PaymentTotals>> => {
  const totals = new Map<string, PaymentTotals>();

  if (expenseIds.length === 0) {
    return totals;
  }

  const rows = await db.expense_payments.groupBy({
    by: ['expense_id', 'status'],
    where: {
      expense_id: { in: expenseIds },
      status: { in: ['pending', 'submitted', 'confirmed'] },
    },
    _sum: { amount: true },
  });

  for (const row of rows) {
    const current = totals.get(row.expense_id) ?? {
      confirmedCents: 0,
      pendingCents: 0,
    };
    const cents = toCents(row._sum.amount);

    if (row.status === 'confirmed') {
      current.confirmedCents += cents;
    } else {
      current.pendingCents += cents;
    }

    totals.set(row.expense_id, current);
  }

  return totals;
};

export const getPaymentTotals = async (
  expenseId: string,
  db: Db = prisma,
): Promise<PaymentTotals> =>
  (await sumPaymentsByExpense([expenseId], db)).get(expenseId) ?? {
    confirmedCents: 0,
    pendingCents: 0,
  };

/**
 * Kunci baris pengeluaran sampai transaksi DB selesai, agar pembayaran
 * yang dibuat/dikonfirmasi bersamaan tidak melampaui total tagihan.
 */
export const lockExpense = async (db: Prisma.TransactionClient, id: string) => {
  await db.$queryRaw`SELECT id FROM expenses WHERE id = ${id} FOR UPDATE`;

  return db.expenses.findUnique({
    where: { id },
    select: { id: true, status: true, total_amount: true, category: true },
  });
};

/** Kategori pengeluaran grup → nama kategori sistem (hasil seed). */
const SYSTEM_CATEGORY_BY_EXPENSE: Record<expenses_category, string> = {
  food: 'Makanan & Minuman',
  transport: 'Transportasi',
  shopping: 'Belanja',
  entertainment: 'Hiburan',
  accommodation: 'Perjalanan',
  travel: 'Perjalanan',
  bills: 'Tagihan & Utilitas',
  health: 'Kesehatan',
  education: 'Pendidikan',
  other: 'Lainnya',
};

/**
 * Transaksi pembayaran patungan diberi kategori sistem yang sesuai agar
 * ikut terhitung di ringkasan per kategori dan anggaran per kategori.
 */
export const findSystemCategoryIdForExpense = async (
  db: Db,
  category: expenses_category,
) => {
  const row = await db.categories.findFirst({
    where: {
      is_system: true,
      type: 'expense',
      name: SYSTEM_CATEGORY_BY_EXPENSE[category],
    },
    select: { id: true },
  });

  return row?.id ?? null;
};

export interface ExpenseSplitData {
  split_method: expenses_split_method;
  total_amount: string;
  members: {
    user_id: string | null;
    guest_name: string | null;
    amount: string;
    percentage: number | null;
    shares: number | null;
    is_payer: boolean;
  }[];
  items: {
    name: string;
    quantity: number;
    unit_price: string;
    members: {
      user_id: string | null;
      guest_name: string | null;
      quantity: number;
      amount: string;
    }[];
  }[];
}

export interface ExpenseInfoData {
  title?: string;
  description?: string | null;
  category?: expenses_category;
  expense_date?: Date;
  event_id?: string | null;
}

const splitWriteData = (split: ExpenseSplitData) => ({
  split_method: split.split_method,
  total_amount: split.total_amount,
  expense_members: {
    createMany: { data: split.members },
  },
  // total_amount item adalah kolom generated (quantity * unit_price).
  expense_items: {
    create: split.items.map((item) => ({
      name: item.name,
      quantity: item.quantity,
      unit_price: item.unit_price,
      expense_item_members: { createMany: { data: item.members } },
    })),
  },
});

export const createExpense = (data: {
  groupId: string;
  createdBy: string;
  status: expenses_status;
  info: Required<ExpenseInfoData>;
  split: ExpenseSplitData;
}) =>
  prisma.expenses.create({
    data: {
      group_id: data.groupId,
      created_by: data.createdBy,
      status: data.status,
      ...data.info,
      ...splitWriteData(data.split),
    },
    select: { id: true },
  });

/** Ubah info pengeluaran; bila `split` dikirim, pembagian diganti total. */
export const updateExpense = (
  id: string,
  info: ExpenseInfoData,
  split?: ExpenseSplitData,
) =>
  prisma.expenses.update({
    where: { id },
    data: {
      ...info,
      ...(split && {
        split_method: split.split_method,
        total_amount: split.total_amount,
        expense_members: {
          deleteMany: {},
          createMany: { data: split.members },
        },
        expense_items: {
          deleteMany: {},
          create: splitWriteData(split).expense_items.create,
        },
      }),
    },
    select: { id: true },
  });

/** Ubah status hanya bila status saat ini sesuai (aman dari race). */
export const transitionExpenseStatus = async (
  id: string,
  from: expenses_status[],
  to: expenses_status,
  db: Db = prisma,
) => {
  const result = await db.expenses.updateMany({
    where: { id, status: { in: from } },
    data: { status: to },
  });

  return result.count === 1;
};

export const updateExpenseReceipt = (id: string, receiptUrl: string | null) =>
  prisma.expenses.update({
    where: { id },
    data: { receipt_url: receiptUrl },
    select: { id: true },
  });

export const cancelOpenPayments = (expenseId: string, db: Db = prisma) =>
  db.expense_payments.updateMany({
    where: { expense_id: expenseId, status: { in: ['pending', 'submitted'] } },
    data: { status: 'cancelled' },
  });

export const findOpenPaymentPayerIds = async (
  expenseId: string,
  db: Db = prisma,
) => {
  const rows = await db.expense_payments.findMany({
    where: { expense_id: expenseId, status: { in: ['pending', 'submitted'] } },
    select: { payer_id: true },
  });

  return rows.map((row) => row.payer_id);
};

export const findPaymentProofUrls = async (
  expenseId: string,
  db: Db = prisma,
) => {
  const rows = await db.expense_payments.findMany({
    where: { expense_id: expenseId, proof_url: { not: null } },
    select: { proof_url: true },
  });

  return rows.map((row) => row.proof_url as string);
};

export const deleteExpense = (id: string, db: Db = prisma) =>
  db.expenses.delete({ where: { id } });

/* ------------------------------------------------------------------ */
/* Pembayaran tagihan                                                  */
/* ------------------------------------------------------------------ */

const paymentSelect = {
  id: true,
  expense_id: true,
  payer_id: true,
  amount: true,
  status: true,
  paid_at: true,
  note: true,
  proof_url: true,
  created_at: true,
  account_id: true,
  users: { select: userRefSelect },
  accounts: { select: accountRefSelect },
  payment_methods: { select: paymentMethodRefSelect },
  expenses: {
    select: {
      id: true,
      title: true,
      group_id: true,
      created_by: true,
      status: true,
      groups: { select: groupRefSelect },
    },
  },
} satisfies Prisma.expense_paymentsSelect;

export type PaymentRow = Prisma.expense_paymentsGetPayload<{
  select: typeof paymentSelect;
}>;

export const findPaymentById = (id: string, db: Db = prisma) =>
  db.expense_payments.findUnique({ where: { id }, select: paymentSelect });

export const findExpensePayments = async (params: {
  expenseId: string;
  status?: expense_payments_status;
  pagination: PaginationParams;
}) => {
  const where: Prisma.expense_paymentsWhereInput = {
    expense_id: params.expenseId,
    status: params.status,
  };

  const [items, total] = await prisma.$transaction([
    prisma.expense_payments.findMany({
      where,
      orderBy: [{ created_at: 'desc' }, { id: 'asc' }],
      skip: (params.pagination.page - 1) * params.pagination.perPage,
      take: params.pagination.perPage,
      select: paymentSelect,
    }),
    prisma.expense_payments.count({ where }),
  ]);

  return { items, total };
};

export const createPayment = (
  db: Db,
  data: {
    expenseId: string;
    payerId: string;
    accountId: string;
    paymentMethodId: string | null;
    amount: string;
    status: expense_payments_status;
    paidAt: Date;
    note: string | null;
  },
) =>
  db.expense_payments.create({
    data: {
      expense_id: data.expenseId,
      payer_id: data.payerId,
      account_id: data.accountId,
      payment_method_id: data.paymentMethodId,
      amount: data.amount,
      status: data.status,
      paid_at: data.paidAt,
      note: data.note,
    },
    select: { id: true },
  });

/** Ubah status pembayaran hanya dari status yang diizinkan. */
export const transitionPaymentStatus = async (
  id: string,
  from: expense_payments_status[],
  data: { status?: expense_payments_status; proof_url?: string | null },
  db: Db = prisma,
) => {
  const result = await db.expense_payments.updateMany({
    where: { id, status: { in: from } },
    data,
  });

  return result.count === 1;
};

/** Catat pengeluaran pembayar di rekeningnya saat pembayaran dikonfirmasi. */
export const createPaymentTransaction = (
  db: Db,
  data: {
    userId: string;
    accountId: string;
    paymentId: string;
    amount: string;
    transactionDate: Date;
    description: string;
    categoryId: string | null;
  },
) =>
  db.transactions.create({
    data: {
      user_id: data.userId,
      account_id: data.accountId,
      category_id: data.categoryId,
      type: 'expense',
      status: 'completed',
      amount: data.amount,
      transaction_date: data.transactionDate,
      description: data.description,
      expense_payment_id: data.paymentId,
    },
    select: { id: true },
  });

/** Anggota terdaftar yang ikut menanggung pengeluaran. */
export const findExpenseMemberIds = async (expenseId: string) => {
  const rows = await prisma.expense_members.findMany({
    where: { expense_id: expenseId, user_id: { not: null } },
    select: { user_id: true },
  });

  return rows.map((row) => row.user_id as string);
};
