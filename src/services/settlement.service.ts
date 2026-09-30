import { prisma } from '../config/database.js';
import {
  findGroupMemberIds,
  findUserNameAndTimezone,
} from '../repositories/expense.repository.js';
import {
  createSettlement as createSettlementRecord,
  createSettlementTransaction,
  deleteSettlementIfStatus,
  findGroupSettlements,
  findSettlementById,
  updateSettlementIfStatus,
  type SettlementListFilters,
  type SettlementRow,
} from '../repositories/settlement.repository.js';
import {
  conflict,
  forbidden,
  notFound,
  unprocessable,
} from '../utils/app-error.js';
import type { PaginationParams } from '../utils/pagination.js';
import type {
  ConfirmSettlementInput,
  CreateSettlementInput,
  UpdateSettlementInput,
} from '../validators/settlement.validator.js';
import { checkBudgetAlerts } from './budget-alert.service.js';
import { toLocalDate } from '../utils/date.js';
import { centsToDecimal, toCents } from './expense-split.service.js';
import { requireGroupMember } from './expense.service.js';
import { formatMoney, notify } from './notifier.service.js';
import {
  requireOwnedAccount,
  resolveFundingSource,
} from './ownership.service.js';
import { deleteImage, saveImage } from './storage.service.js';

/**
 * Pelunasan utang antar anggota di level grup. Besar utang dihitung
 * oleh balance.service (GET /groups/:groupId/balances); pelunasan yang
 * confirmed ikut mengurangi saldo utang tersebut.
 */

const settlementNotFound = () =>
  notFound('SETTLEMENT_NOT_FOUND', 'Pelunasan tidak ditemukan');

const settlementAlreadyProcessed = () =>
  conflict('SETTLEMENT_ALREADY_PROCESSED', 'Pelunasan ini sudah diproses');

const reloadSettlement = async (id: string) => {
  const settlement = await findSettlementById(id);

  if (!settlement) {
    throw settlementNotFound();
  }

  return settlement;
};

/** Pihak pelunasan selalu boleh melihat; selainnya harus anggota grup. */
export const getSettlement = async (userId: string, id: string) => {
  const settlement = await reloadSettlement(id);

  if (settlement.from_user_id !== userId && settlement.to_user_id !== userId) {
    await requireGroupMember(settlement.group_id, userId);
  }

  return settlement;
};

const requireSender = (
  settlement: SettlementRow,
  userId: string,
  action: string,
) => {
  if (settlement.from_user_id !== userId) {
    throw forbidden(
      'SETTLEMENT_ACCESS_DENIED',
      `Hanya pengirim yang bisa ${action}`,
    );
  }
};

const requireRecipient = (
  settlement: SettlementRow,
  userId: string,
  action: string,
) => {
  if (settlement.to_user_id !== userId) {
    throw forbidden(
      'SETTLEMENT_ACCESS_DENIED',
      `Hanya penerima yang bisa ${action}`,
    );
  }
};

const requirePending = (settlement: SettlementRow) => {
  if (settlement.status !== 'pending') {
    throw settlementAlreadyProcessed();
  }
};

const settlementMoney = (settlement: SettlementRow) =>
  formatMoney(settlement.amount, settlement.groups.currency);

const notifySettlement = (
  settlement: SettlementRow,
  recipientId: string,
  actorId: string,
  title: string,
  message: string,
) =>
  notify({
    userIds: recipientId,
    type: 'settlement',
    title,
    message,
    data: { settlement_id: settlement.id, group_id: settlement.group_id },
    excludeUserId: actorId,
  });

/* ------------------------------------------------------------------ */
/* CRUD                                                                */
/* ------------------------------------------------------------------ */

export const createSettlement = async (
  userId: string,
  groupId: string,
  input: CreateSettlementInput,
) => {
  await requireGroupMember(groupId, userId);

  if (input.to_user_id === userId) {
    throw unprocessable(
      'SELF_SETTLEMENT',
      'Kamu tidak bisa melunasi ke diri sendiri',
    );
  }

  const memberIds = await findGroupMemberIds(groupId, [input.to_user_id]);

  if (!memberIds.has(input.to_user_id)) {
    throw unprocessable(
      'MEMBER_NOT_IN_GROUP',
      'Penerima pelunasan bukan anggota grup ini',
    );
  }

  const funding = await resolveFundingSource(userId, input);

  const { id } = await createSettlementRecord({
    groupId,
    fromUserId: userId,
    toUserId: input.to_user_id,
    accountId: funding.accountId,
    paymentMethodId: funding.paymentMethodId,
    amount: centsToDecimal(toCents(input.amount)),
    note: input.note ?? null,
  });

  const settlement = await reloadSettlement(id);

  await notifySettlement(
    settlement,
    settlement.to_user_id,
    userId,
    'Pelunasan masuk',
    `${settlement.users_settlements_from_user_idTousers.name} mengirim pelunasan ${settlementMoney(settlement)} di grup ${settlement.groups.name}. Konfirmasi bila uangnya sudah kamu terima.`,
  );

  return settlement;
};

export interface SettlementListQuery
  extends Omit<SettlementListFilters, 'involvingUserId'> {
  involvingMe?: boolean;
}

export const listGroupSettlements = async (
  userId: string,
  groupId: string,
  pagination: PaginationParams,
  query: SettlementListQuery,
) => {
  await requireGroupMember(groupId, userId);

  const { involvingMe, ...filters } = query;

  return findGroupSettlements({
    groupId,
    pagination,
    filters: {
      ...filters,
      involvingUserId: involvingMe ? userId : undefined,
    },
  });
};

export const updateSettlement = async (
  userId: string,
  id: string,
  input: UpdateSettlementInput,
) => {
  const settlement = await getSettlement(userId, id);

  requireSender(settlement, userId, 'mengubah pelunasan ini');
  requirePending(settlement);

  const data: {
    amount?: string;
    note?: string | null;
    account_id?: string | null;
    payment_method_id?: string | null;
  } = {};

  if (input.amount !== undefined) {
    data.amount = centsToDecimal(toCents(input.amount));
  }

  if (input.note !== undefined) {
    data.note = input.note;
  }

  if (input.account_id !== undefined || input.payment_method_id !== undefined) {
    const funding = await resolveFundingSource(userId, input);

    data.account_id = funding.accountId;
    data.payment_method_id = funding.paymentMethodId;
  }

  if (!(await updateSettlementIfStatus(id, ['pending'], data))) {
    throw settlementAlreadyProcessed();
  }

  return reloadSettlement(id);
};

export const deleteSettlement = async (userId: string, id: string) => {
  const settlement = await getSettlement(userId, id);

  requireSender(settlement, userId, 'menghapus pelunasan ini');

  const deleted = await deleteSettlementIfStatus(id, [
    'pending',
    'rejected',
    'cancelled',
  ]);

  if (!deleted) {
    throw conflict(
      'SETTLEMENT_ALREADY_PROCESSED',
      'Pelunasan yang sudah dikonfirmasi tidak bisa dihapus',
    );
  }

  await deleteImage(settlement.proof_url);
};

/* ------------------------------------------------------------------ */
/* Konfirmasi / tolak / batal                                          */
/* ------------------------------------------------------------------ */

/**
 * Hanya penerima yang mengonfirmasi, karena dialah yang tahu uangnya
 * sudah masuk. Transaksi keluar dicatat di rekening sumber dana
 * pengirim (bila ada), dan transaksi masuk di rekening penerima bila
 * penerima memilih `account_id`.
 */
export const confirmSettlement = async (
  userId: string,
  id: string,
  input: ConfirmSettlementInput,
) => {
  const settlement = await getSettlement(userId, id);

  requireRecipient(settlement, userId, 'mengonfirmasi pelunasan ini');
  requirePending(settlement);

  const recipientAccount = input.account_id
    ? await requireOwnedAccount(input.account_id, userId)
    : null;

  const sender = settlement.users_settlements_from_user_idTousers;
  const recipient = settlement.users_settlements_to_user_idTousers;
  const [senderZone, recipientZone] = await Promise.all([
    findUserNameAndTimezone(sender.id),
    findUserNameAndTimezone(recipient.id),
  ]);

  const settledAt = new Date();
  const senderDate = toLocalDate(settledAt, senderZone.timezone);
  const amount = centsToDecimal(toCents(settlement.amount));
  const senderAccountId = settlement.account_id;

  await prisma.$transaction(async (tx) => {
    const confirmed = await updateSettlementIfStatus(
      id,
      ['pending'],
      { status: 'confirmed', settled_at: settledAt },
      tx,
    );

    if (!confirmed) {
      throw settlementAlreadyProcessed();
    }

    if (senderAccountId) {
      await createSettlementTransaction(tx, {
        userId: sender.id,
        accountId: senderAccountId,
        settlementId: id,
        type: 'expense',
        amount,
        transactionDate: senderDate,
        description: `Pelunasan ke ${recipient.name}`,
      });
    }

    if (recipientAccount) {
      await createSettlementTransaction(tx, {
        userId: recipient.id,
        accountId: recipientAccount.id,
        settlementId: id,
        type: 'income',
        amount,
        transactionDate: toLocalDate(settledAt, recipientZone.timezone),
        description: `Pelunasan dari ${sender.name}`,
      });
    }
  });

  await notifySettlement(
    settlement,
    sender.id,
    userId,
    'Pelunasan dikonfirmasi',
    `${recipient.name} mengonfirmasi pelunasan ${settlementMoney(settlement)} darimu`,
  );

  if (senderAccountId) {
    await checkBudgetAlerts(sender.id, senderDate);
  }

  return reloadSettlement(id);
};

export const rejectSettlement = async (userId: string, id: string) => {
  const settlement = await getSettlement(userId, id);

  requireRecipient(settlement, userId, 'menolak pelunasan ini');
  requirePending(settlement);

  if (!(await updateSettlementIfStatus(id, ['pending'], { status: 'rejected' }))) {
    throw settlementAlreadyProcessed();
  }

  await notifySettlement(
    settlement,
    settlement.from_user_id,
    userId,
    'Pelunasan ditolak',
    `${settlement.users_settlements_to_user_idTousers.name} menolak pelunasan ${settlementMoney(settlement)} darimu`,
  );

  return reloadSettlement(id);
};

export const cancelSettlement = async (userId: string, id: string) => {
  const settlement = await getSettlement(userId, id);

  requireSender(settlement, userId, 'membatalkan pelunasan ini');
  requirePending(settlement);

  if (!(await updateSettlementIfStatus(id, ['pending'], { status: 'cancelled' }))) {
    throw settlementAlreadyProcessed();
  }

  await notifySettlement(
    settlement,
    settlement.to_user_id,
    userId,
    'Pelunasan dibatalkan',
    `${settlement.users_settlements_from_user_idTousers.name} membatalkan pelunasan ${settlementMoney(settlement)}`,
  );

  return reloadSettlement(id);
};

/* ------------------------------------------------------------------ */
/* Bukti transfer                                                      */
/* ------------------------------------------------------------------ */

export const updateSettlementProof = async (
  userId: string,
  id: string,
  file: Express.Multer.File | undefined,
) => {
  const settlement = await getSettlement(userId, id);

  requireSender(settlement, userId, 'mengunggah bukti pelunasan');
  requirePending(settlement);

  const path = await saveImage(file, 'proofs');
  const updated = await updateSettlementIfStatus(id, ['pending'], {
    proof_url: path,
  }).catch(async (error: unknown) => {
    await deleteImage(path);
    throw error;
  });

  if (!updated) {
    await deleteImage(path);
    throw settlementAlreadyProcessed();
  }

  await deleteImage(settlement.proof_url);

  return reloadSettlement(id);
};

export const removeSettlementProof = async (userId: string, id: string) => {
  const settlement = await getSettlement(userId, id);

  requireSender(settlement, userId, 'menghapus bukti pelunasan');
  requirePending(settlement);

  if (!(await updateSettlementIfStatus(id, ['pending'], { proof_url: null }))) {
    throw settlementAlreadyProcessed();
  }

  await deleteImage(settlement.proof_url);

  return reloadSettlement(id);
};
