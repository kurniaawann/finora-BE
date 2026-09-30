import { prisma } from '../config/database.js';
import { toNumber } from '../dtos/common.dto.js';
import type { ExpenseDetailView, GroupViewer } from '../dtos/expense.dto.js';
import type { expenses_status } from '../generated/prisma/enums.js';
import {
  cancelOpenPayments,
  createExpense as createExpenseRecord,
  deleteExpense as deleteExpenseRecord,
  findExpenseById,
  findExpenseMemberIds,
  findGroupEvent,
  findGroupExpenses,
  findGroupMemberIds,
  findGroupMembership,
  findOpenPaymentPayerIds,
  findPaymentProofUrls,
  findUserNameAndTimezone,
  getPaymentTotals,
  lockExpense,
  sumPaymentsByExpense,
  transitionExpenseStatus,
  updateExpense as updateExpenseRecord,
  updateExpenseReceipt,
  type ExpenseDetailRow,
  type ExpenseInfoData,
  type ExpenseListFilters,
  type ExpenseSplitData,
} from '../repositories/expense.repository.js';
import {
  conflict,
  forbidden,
  notFound,
  unprocessable,
} from '../utils/app-error.js';
import type { PaginationParams } from '../utils/pagination.js';
import type {
  CreateExpenseInput,
  UpdateExpenseInput,
} from '../validators/expense.validator.js';
import {
  centsToDecimal,
  computeSplit,
  toCents,
  type SplitInput,
  type SplitMemberInput,
} from './expense-split.service.js';
import { formatMoney, notify } from './notifier.service.js';
import { deleteImage, saveImage } from './storage.service.js';

const MANAGER_ROLES = new Set(['owner', 'admin']);

/* ------------------------------------------------------------------ */
/* Akses                                                               */
/* ------------------------------------------------------------------ */

export const requireGroupMember = async (groupId: string, userId: string) => {
  const membership = await findGroupMembership(groupId, userId);

  if (!membership) {
    throw forbidden('GROUP_ACCESS_DENIED', 'Kamu bukan anggota grup ini');
  }

  const viewer: GroupViewer = {
    userId,
    isManager: MANAGER_ROLES.has(membership.role),
  };

  return { group: membership.groups, viewer };
};

/** Pembuat pengeluaran atau owner/admin grup. */
export const canManageExpense = (
  expense: { created_by: string },
  viewer: GroupViewer,
) => expense.created_by === viewer.userId || viewer.isManager;

const requireExpenseManager = (
  expense: { created_by: string },
  viewer: GroupViewer,
) => {
  if (!canManageExpense(expense, viewer)) {
    throw forbidden(
      'EXPENSE_ACCESS_DENIED',
      'Hanya pembuat pengeluaran atau admin grup yang bisa melakukan ini',
    );
  }
};

export const loadExpense = async (userId: string, expenseId: string) => {
  const expense = await findExpenseById(expenseId);

  if (!expense) {
    throw notFound('EXPENSE_NOT_FOUND', 'Pengeluaran tidak ditemukan');
  }

  const { viewer } = await requireGroupMember(expense.group_id, userId);

  return { expense, viewer };
};

export const getExpense = async (
  userId: string,
  expenseId: string,
): Promise<ExpenseDetailView> => {
  const { expense, viewer } = await loadExpense(userId, expenseId);

  return {
    expense,
    viewer,
    totals: await getPaymentTotals(expense.id),
  };
};

/* ------------------------------------------------------------------ */
/* Validasi pembagian                                                  */
/* ------------------------------------------------------------------ */

const toDbDate = (date: string) => new Date(`${date}T00:00:00.000Z`);

const requireUsableEvent = async (groupId: string, eventId: string) => {
  const event = await findGroupEvent(eventId, groupId);

  if (!event) {
    throw notFound('EVENT_NOT_FOUND', 'Acara tidak ditemukan di grup ini');
  }

  if (event.status === 'cancelled') {
    throw unprocessable('EVENT_CANCELLED', 'Acara ini sudah dibatalkan');
  }
};

const resolveSplit = async (
  groupId: string,
  input: SplitInput,
): Promise<ExpenseSplitData> => {
  const split = computeSplit(input);
  const userIds = split.members
    .map((member) => member.userId)
    .filter((id): id is string => id !== null);

  if (userIds.length === 0) {
    throw unprocessable(
      'REGISTERED_MEMBER_REQUIRED',
      'Minimal satu anggota grup harus ikut menanggung pengeluaran',
    );
  }

  const memberIds = await findGroupMemberIds(groupId, userIds);

  if (userIds.some((id) => !memberIds.has(id))) {
    throw unprocessable(
      'MEMBER_NOT_IN_GROUP',
      'Semua anggota yang ikut menanggung harus anggota grup ini',
    );
  }

  return {
    split_method: input.splitMethod,
    total_amount: centsToDecimal(toCents(input.totalAmount)),
    members: split.members.map((member) => ({
      user_id: member.userId,
      guest_name: member.guestName,
      amount: centsToDecimal(member.amountCents),
      percentage: member.percentage,
      shares: member.shares,
      is_payer: member.isPayer,
    })),
    items: split.items.map((item) => ({
      name: item.name,
      quantity: item.quantity,
      unit_price: centsToDecimal(item.unitPriceCents),
      members: item.members.map((member) => ({
        user_id: member.userId,
        guest_name: member.guestName,
        quantity: member.quantity,
        amount: centsToDecimal(member.amountCents),
      })),
    })),
  };
};

const existingMembers = (expense: ExpenseDetailRow): SplitMemberInput[] =>
  expense.expense_members.map((member) => ({
    user_id: member.user_id,
    guest_name: member.guest_name,
    amount: toNumber(member.amount),
    percentage: member.percentage === null ? null : toNumber(member.percentage),
    shares: member.shares === null ? null : toNumber(member.shares),
    is_payer: member.is_payer,
  }));

const existingItems = (expense: ExpenseDetailRow) =>
  expense.expense_items.map((item) => ({
    name: item.name,
    quantity: toNumber(item.quantity),
    unit_price: toNumber(item.unit_price),
    members: item.expense_item_members.map((member) => ({
      user_id: member.user_id,
      guest_name: member.guest_name,
      quantity: toNumber(member.quantity),
    })),
  }));

/* ------------------------------------------------------------------ */
/* Notifikasi                                                          */
/* ------------------------------------------------------------------ */

/** Tiap anggota diberi tahu tanggungannya sendiri. */
const notifyExpenseActivated = async (
  expense: ExpenseDetailRow,
  actorId: string,
) => {
  await Promise.all(
    expense.expense_members
      .filter((member) => member.user_id && toCents(member.amount) > 0)
      .map((member) =>
        notify({
          userIds: member.user_id as string,
          type: 'expense',
          title: 'Tagihan patungan baru',
          message: `Kamu kebagian ${formatMoney(member.amount, expense.groups.currency)} untuk "${expense.title}" di grup ${expense.groups.name}`,
          data: { expense_id: expense.id, group_id: expense.group_id },
          excludeUserId: actorId,
        }),
      ),
  );
};

export const notifyExpenseSettled = async (
  expense: { id: string; title: string; group_id: string },
  actorId: string,
) => {
  await notify({
    userIds: await findExpenseMemberIds(expense.id),
    type: 'expense',
    title: 'Tagihan lunas',
    message: `Tagihan "${expense.title}" sudah lunas dibayar. Cek saldo grup untuk melihat siapa berutang ke siapa.`,
    data: { expense_id: expense.id, group_id: expense.group_id },
    excludeUserId: actorId,
  });
};

/* ------------------------------------------------------------------ */
/* CRUD pengeluaran                                                    */
/* ------------------------------------------------------------------ */

export const createExpense = async (
  userId: string,
  groupId: string,
  input: CreateExpenseInput,
) => {
  await requireGroupMember(groupId, userId);

  if (input.event_id) {
    await requireUsableEvent(groupId, input.event_id);
  }

  const split = await resolveSplit(groupId, {
    totalAmount: input.total_amount,
    splitMethod: input.split_method,
    members: input.members,
    items: input.items,
  });

  const status: expenses_status = input.as_draft ? 'draft' : 'active';

  const { id } = await createExpenseRecord({
    groupId,
    createdBy: userId,
    status,
    info: {
      title: input.title,
      description: input.description ?? null,
      category: input.category,
      expense_date: toDbDate(input.expense_date),
      event_id: input.event_id ?? null,
    },
    split,
  });

  const view = await getExpense(userId, id);

  if (status === 'active') {
    await notifyExpenseActivated(view.expense, userId);
  }

  return view;
};

export interface ExpenseListQuery
  extends Omit<ExpenseListFilters, 'involvingUserId'> {
  involvingMe?: boolean;
}

export const listGroupExpenses = async (
  userId: string,
  groupId: string,
  pagination: PaginationParams,
  query: ExpenseListQuery,
) => {
  await requireGroupMember(groupId, userId);

  const { involvingMe, ...filters } = query;
  const { items, total } = await findGroupExpenses({
    groupId,
    viewerId: userId,
    pagination,
    filters: {
      ...filters,
      involvingUserId: involvingMe ? userId : undefined,
    },
  });

  return {
    items,
    total,
    totals: await sumPaymentsByExpense(items.map((item) => item.id)),
  };
};

const SPLIT_FIELDS = ['total_amount', 'split_method', 'members', 'items'] as const;

export const updateExpense = async (
  userId: string,
  expenseId: string,
  input: UpdateExpenseInput,
) => {
  const { expense, viewer } = await loadExpense(userId, expenseId);

  requireExpenseManager(expense, viewer);

  if (expense.status === 'settled' || expense.status === 'cancelled') {
    throw conflict(
      'EXPENSE_LOCKED',
      'Pengeluaran yang sudah lunas atau dibatalkan tidak bisa diubah',
    );
  }

  const touchesSplit = SPLIT_FIELDS.some((field) => input[field] !== undefined);

  if (touchesSplit && expense.status !== 'draft') {
    throw conflict(
      'EXPENSE_SPLIT_LOCKED',
      'Nominal dan pembagian sudah dikunci. Batalkan lalu buat ulang pengeluaran bila perlu diubah',
    );
  }

  if (input.event_id && input.event_id !== expense.event_id) {
    await requireUsableEvent(expense.group_id, input.event_id);
  }

  const info: ExpenseInfoData = {
    title: input.title,
    description: input.description,
    category: input.category,
    expense_date: input.expense_date ? toDbDate(input.expense_date) : undefined,
    event_id: input.event_id,
  };

  let split: ExpenseSplitData | undefined;

  if (touchesSplit) {
    const splitMethod = input.split_method ?? expense.split_method;
    const members = existingMembers(expense);

    // Field yang tidak dikirim memakai nilai lama. Untuk split item,
    // anggota lama hanya dibawa bila ditandai sebagai pembayar.
    split = await resolveSplit(expense.group_id, {
      totalAmount: input.total_amount ?? toNumber(expense.total_amount),
      splitMethod,
      members:
        input.members ??
        (splitMethod === 'item'
          ? members.filter((member) => member.is_payer)
          : members),
      items: input.items ?? existingItems(expense),
    });
  }

  await updateExpenseRecord(expenseId, info, split);

  return getExpense(userId, expenseId);
};

export const activateExpense = async (userId: string, expenseId: string) => {
  const { expense, viewer } = await loadExpense(userId, expenseId);

  requireExpenseManager(expense, viewer);

  const activated =
    expense.status === 'draft' &&
    (await transitionExpenseStatus(expenseId, ['draft'], 'active'));

  if (!activated) {
    throw conflict(
      'EXPENSE_NOT_DRAFT',
      'Hanya pengeluaran draft yang bisa diaktifkan',
    );
  }

  const view = await getExpense(userId, expenseId);

  await notifyExpenseActivated(view.expense, userId);

  return view;
};

const expenseLocked = () =>
  conflict(
    'EXPENSE_LOCKED',
    'Pengeluaran sudah lunas atau sudah dibatalkan',
  );

const expenseHasPayments = (action: string) =>
  conflict(
    'EXPENSE_HAS_PAYMENTS',
    `Pengeluaran yang sudah punya pembayaran terkonfirmasi tidak bisa ${action}`,
  );

/**
 * Batalkan pengeluaran. Pembayaran yang masih menunggu konfirmasi ikut
 * dibatalkan; bila sudah ada pembayaran terkonfirmasi, ditolak.
 */
export const cancelExpense = async (userId: string, expenseId: string) => {
  const { expense, viewer } = await loadExpense(userId, expenseId);

  requireExpenseManager(expense, viewer);

  const payerIds = await prisma.$transaction(async (tx) => {
    const locked = await lockExpense(tx, expenseId);

    if (!locked || locked.status === 'settled' || locked.status === 'cancelled') {
      throw expenseLocked();
    }

    const totals = await getPaymentTotals(expenseId, tx);

    if (totals.confirmedCents > 0) {
      throw expenseHasPayments('dibatalkan');
    }

    const openPayerIds = await findOpenPaymentPayerIds(expenseId, tx);

    await cancelOpenPayments(expenseId, tx);
    await transitionExpenseStatus(expenseId, [locked.status], 'cancelled', tx);

    return openPayerIds;
  });

  if (expense.status === 'active') {
    const actor = await findUserNameAndTimezone(userId);

    await notify({
      userIds: [
        ...expense.expense_members
          .map((member) => member.user_id)
          .filter((id): id is string => id !== null),
        ...payerIds,
      ],
      type: 'expense',
      title: 'Patungan dibatalkan',
      message: `"${expense.title}" di grup ${expense.groups.name} dibatalkan oleh ${actor.name}`,
      data: { expense_id: expense.id, group_id: expense.group_id },
      excludeUserId: userId,
    });
  }

  return getExpense(userId, expenseId);
};

export const deleteExpense = async (userId: string, expenseId: string) => {
  const { expense, viewer } = await loadExpense(userId, expenseId);

  requireExpenseManager(expense, viewer);

  const proofUrls = await prisma.$transaction(async (tx) => {
    const locked = await lockExpense(tx, expenseId);

    if (!locked || (locked.status !== 'draft' && locked.status !== 'cancelled')) {
      throw conflict(
        'EXPENSE_LOCKED',
        'Hanya pengeluaran draft atau yang sudah dibatalkan yang bisa dihapus',
      );
    }

    if ((await getPaymentTotals(expenseId, tx)).confirmedCents > 0) {
      throw expenseHasPayments('dihapus');
    }

    const urls = await findPaymentProofUrls(expenseId, tx);

    await deleteExpenseRecord(expenseId, tx);

    return urls;
  });

  await Promise.all(
    [expense.receipt_url, ...proofUrls].map((path) => deleteImage(path)),
  );
};

/* ------------------------------------------------------------------ */
/* Foto struk                                                          */
/* ------------------------------------------------------------------ */

const loadReceiptEditableExpense = async (userId: string, expenseId: string) => {
  const { expense, viewer } = await loadExpense(userId, expenseId);

  requireExpenseManager(expense, viewer);

  if (expense.status === 'cancelled') {
    throw conflict(
      'EXPENSE_LOCKED',
      'Pengeluaran yang dibatalkan tidak bisa diubah',
    );
  }

  return expense;
};

export const updateExpenseReceiptPhoto = async (
  userId: string,
  expenseId: string,
  file: Express.Multer.File | undefined,
) => {
  const expense = await loadReceiptEditableExpense(userId, expenseId);
  const path = await saveImage(file, 'receipts');

  try {
    await updateExpenseReceipt(expenseId, path);
  } catch (error) {
    await deleteImage(path);
    throw error;
  }

  await deleteImage(expense.receipt_url);

  return getExpense(userId, expenseId);
};

export const removeExpenseReceiptPhoto = async (
  userId: string,
  expenseId: string,
) => {
  const expense = await loadReceiptEditableExpense(userId, expenseId);

  await updateExpenseReceipt(expenseId, null);
  await deleteImage(expense.receipt_url);

  return getExpense(userId, expenseId);
};
