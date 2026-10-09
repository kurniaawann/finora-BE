import { prisma } from '../config/database.js';
import { Prisma } from '../generated/prisma/client.js';
import { getAccountBalances } from '../repositories/account.repository.js';
import {
  createTransfer as insertTransfer,
  deleteTransfer as removeTransfer,
  findTransferById,
  findTransfers,
  lockAccounts,
  lockTransfer,
  updateTransfer as saveTransfer,
  updateTransferProof,
  type TransferFilters,
} from '../repositories/transfer.repository.js';
import { conflict, notFound, unprocessable } from '../utils/app-error.js';
import type { PaginationParams } from '../utils/pagination.js';
import { deleteImage, saveImage } from './storage.service.js';
import type {
  CreateTransferInput,
  UpdateTransferInput,
} from '../validators/transfer.validator.js';

type LockedAccount = Awaited<ReturnType<typeof lockAccounts>> extends Map<
  string,
  infer T
>
  ? T
  : never;

const toDate = (value: string) => new Date(`${value}T00:00:00.000Z`);

const transferNotFound = () =>
  notFound('TRANSFER_NOT_FOUND', 'Transfer tidak ditemukan');

const assertDifferentAccounts = (fromId: string, toId: string) => {
  if (fromId === toId) {
    throw unprocessable(
      'SAME_ACCOUNT',
      'Rekening asal dan tujuan tidak boleh sama',
    );
  }
};

/**
 * Ambil rekening hasil penguncian. Rekening yang baru dipilih wajib
 * aktif; rekening lama yang tidak diubah boleh sudah diarsipkan.
 */
const pickAccount = (
  accounts: Map<string, LockedAccount>,
  accountId: string,
  side: 'from' | 'to',
  mustBeActive: boolean,
) => {
  const account = accounts.get(accountId);

  if (!account || (mustBeActive && !account.is_active)) {
    throw side === 'from'
      ? notFound('FROM_ACCOUNT_NOT_FOUND', 'Rekening asal tidak ditemukan')
      : notFound('TO_ACCOUNT_NOT_FOUND', 'Rekening tujuan tidak ditemukan');
  }

  return account;
};

const assertSameCurrency = (from: LockedAccount, to: LockedAccount) => {
  if (from.currency !== to.currency) {
    throw unprocessable(
      'CURRENCY_MISMATCH',
      'Mata uang rekening asal dan tujuan harus sama',
    );
  }
};

/**
 * Saldo rekening asal harus cukup, kecuali kartu kredit (boleh
 * menambah utang). `reserved` = pengaruh transfer lama terhadap saldo
 * rekening asal yang dikembalikan dulu sebelum dicek (saat update).
 */
const assertSufficientFunds = async (
  tx: Prisma.TransactionClient,
  userId: string,
  account: LockedAccount,
  amount: Prisma.Decimal,
  reserved: Prisma.Decimal = new Prisma.Decimal(0),
) => {
  if (account.type === 'credit_card') {
    return;
  }

  const balances = await getAccountBalances(userId, [account.id], tx);
  const available = account.initial_balance
    .add(balances.get(account.id) ?? 0)
    .add(reserved);

  if (available.lessThan(amount)) {
    throw unprocessable(
      'INSUFFICIENT_FUNDS',
      `Saldo ${account.name} tidak mencukupi`,
    );
  }
};

const buildWriteData = (params: {
  from: LockedAccount;
  to: LockedAccount;
  amount: Prisma.Decimal;
  transferDate: Date;
  note: string | null;
}) => ({
  fromAccountId: params.from.id,
  toAccountId: params.to.id,
  amount: params.amount,
  transferDate: params.transferDate,
  note: params.note,
  fromDescription: params.note ?? `Transfer ke ${params.to.name}`,
  toDescription: params.note ?? `Transfer dari ${params.from.name}`,
});

export const listTransfers = (
  userId: string,
  pagination: PaginationParams,
  filters: TransferFilters,
) => findTransfers({ userId, ...pagination, filters });

export const getTransfer = async (userId: string, transferId: string) => {
  const transfer = await findTransferById(transferId, userId);

  if (!transfer) {
    throw transferNotFound();
  }

  return transfer;
};

export const createTransfer = async (
  userId: string,
  input: CreateTransferInput,
) => {
  assertDifferentAccounts(input.from_account_id, input.to_account_id);

  const amount = new Prisma.Decimal(input.amount);

  return prisma.$transaction(async (tx) => {
    const accounts = await lockAccounts(tx, userId, [
      input.from_account_id,
      input.to_account_id,
    ]);
    const from = pickAccount(accounts, input.from_account_id, 'from', true);
    const to = pickAccount(accounts, input.to_account_id, 'to', true);

    assertSameCurrency(from, to);
    await assertSufficientFunds(tx, userId, from, amount);

    return insertTransfer(
      tx,
      userId,
      buildWriteData({
        from,
        to,
        amount,
        transferDate: toDate(input.transfer_date),
        note: input.note ?? null,
      }),
    );
  });
};

export const updateTransfer = async (
  userId: string,
  transferId: string,
  input: UpdateTransferInput,
) =>
  prisma.$transaction(async (tx) => {
    if (!(await lockTransfer(tx, userId, transferId))) {
      throw transferNotFound();
    }

    const existing = await findTransferById(transferId, userId, tx);

    if (!existing) {
      throw transferNotFound();
    }

    const { from_transaction_id, to_transaction_id } = existing;

    if (!from_transaction_id || !to_transaction_id) {
      throw conflict(
        'TRANSFER_INVALID',
        'Data transfer tidak lengkap, hapus lalu buat ulang transfer ini',
      );
    }

    const fromId = input.from_account_id ?? existing.from_account_id;
    const toId = input.to_account_id ?? existing.to_account_id;
    const amount = new Prisma.Decimal(input.amount ?? existing.amount);

    assertDifferentAccounts(fromId, toId);

    const accounts = await lockAccounts(tx, userId, [fromId, toId]);
    const from = pickAccount(
      accounts,
      fromId,
      'from',
      fromId !== existing.from_account_id,
    );
    const to = pickAccount(
      accounts,
      toId,
      'to',
      toId !== existing.to_account_id,
    );

    assertSameCurrency(from, to);

    // Saldo hanya perlu dicek bila rekening asal berubah atau nominal naik.
    if (fromId !== existing.from_account_id || amount.gt(existing.amount)) {
      let reserved = new Prisma.Decimal(0);

      if (fromId === existing.from_account_id) {
        reserved = reserved.add(existing.amount);
      }

      if (fromId === existing.to_account_id) {
        reserved = reserved.sub(existing.amount);
      }

      await assertSufficientFunds(tx, userId, from, amount, reserved);
    }

    return saveTransfer(
      tx,
      { id: existing.id, from_transaction_id, to_transaction_id },
      buildWriteData({
        from,
        to,
        amount,
        transferDate: input.transfer_date
          ? toDate(input.transfer_date)
          : existing.transfer_date,
        note: input.note !== undefined ? input.note : existing.note,
      }),
    );
  });

export const deleteTransfer = async (userId: string, transferId: string) => {
  const proofUrl = await prisma.$transaction(async (tx) => {
    if (!(await lockTransfer(tx, userId, transferId))) {
      throw transferNotFound();
    }

    const existing = await findTransferById(transferId, userId, tx);

    if (!existing) {
      throw transferNotFound();
    }

    await removeTransfer(tx, existing);

    return existing.proof_url;
  });

  await deleteImage(proofUrl);
};

export const updateTransferProofPhoto = async (
  userId: string,
  transferId: string,
  file: Express.Multer.File | undefined,
) => {
  const transfer = await getTransfer(userId, transferId);
  const path = await saveImage(file, 'proofs');

  let updated;

  try {
    updated = await updateTransferProof(transferId, path);
  } catch (error) {
    await deleteImage(path);
    throw error;
  }

  await deleteImage(transfer.proof_url);

  return updated;
};

export const removeTransferProofPhoto = async (
  userId: string,
  transferId: string,
) => {
  const transfer = await getTransfer(userId, transferId);
  const updated = await updateTransferProof(transferId, null);

  await deleteImage(transfer.proof_url);

  return updated;
};
