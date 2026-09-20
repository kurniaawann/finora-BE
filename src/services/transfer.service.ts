import {
  createTransfer,
  deleteTransfer,
  findAccountByIdAndUser,
  findTransferById,
  findTransfersByUser,
  updateTransfer,
} from '../repositories/transfer.repository.js';

import { Prisma } from '../generated/prisma/client.js';

import type {
  CreateTransferInput,
  UpdateTransferInput,
} from '../validators/transfer.validator.js';

const assertCurrencyCompatible = (
  fromCurrency: string,
  toCurrency: string,
) => {
  if (fromCurrency !== toCurrency) {
    throw new Error('CURRENCY_MISMATCH');
  }
};

const assertSufficientFunds = (
  balance: Prisma.Decimal,
  amount: Prisma.Decimal,
) => {
  if (balance.lessThan(amount)) {
    throw new Error('INSUFFICIENT_FUNDS');
  }
};

export const createTransferService = async (
  userId: string,
  data: CreateTransferInput,
) => {
  const fromAccount = await findAccountByIdAndUser(
    data.from_account_id,
    userId,
  );

  if (!fromAccount) {
    throw new Error('FROM_ACCOUNT_NOT_FOUND');
  }

  const toAccount = await findAccountByIdAndUser(
    data.to_account_id,
    userId,
  );

  if (!toAccount) {
    throw new Error('TO_ACCOUNT_NOT_FOUND');
  }

  if (fromAccount.id === toAccount.id) {
    throw new Error('SAME_ACCOUNT');
  }

  assertCurrencyCompatible(
    fromAccount.currency,
    toAccount.currency,
  );

  assertSufficientFunds(
    fromAccount.current_balance,
    new Prisma.Decimal(data.amount),
  );

  return createTransfer({
    userId,
    fromAccountId: data.from_account_id,
    toAccountId: data.to_account_id,
    amount: data.amount,
    transferDate: new Date(data.transfer_date),
    note: data.note ?? null,
  });
};

export const getTransfersService = async (
  userId: string,
  page: number,
  perPage: number,
) => {
  return findTransfersByUser(userId, page, perPage);
};

export const getTransferService = async (
  transferId: string,
  userId: string,
) => {
  const transfer = await findTransferById(
    transferId,
    userId,
  );

  if (!transfer) {
    throw new Error('TRANSFER_NOT_FOUND');
  }

  return transfer;
};

export const updateTransferService = async (
  transferId: string,
  userId: string,
  data: UpdateTransferInput,
) => {
  const existing = await findTransferById(
    transferId,
    userId,
  );

  if (!existing) {
    throw new Error('TRANSFER_NOT_FOUND');
  }

  const fromTransaction =
    existing
      .transactions_transfers_from_transaction_idTotransactions;
  const toTransaction =
    existing
      .transactions_transfers_to_transaction_idTotransactions;

  if (!fromTransaction || !toTransaction) {
    throw new Error('TRANSFER_INVALID');
  }

  const fromAccountId =
    data.from_account_id ?? existing.from_account_id;
  const toAccountId =
    data.to_account_id ?? existing.to_account_id;
  const amount = new Prisma.Decimal(
    data.amount ?? existing.amount,
  );

  if (fromAccountId === toAccountId) {
    throw new Error('SAME_ACCOUNT');
  }

  const fromAccount = await findAccountByIdAndUser(
    fromAccountId,
    userId,
  );

  if (!fromAccount) {
    throw new Error('FROM_ACCOUNT_NOT_FOUND');
  }

  const toAccount = await findAccountByIdAndUser(
    toAccountId,
    userId,
  );

  if (!toAccount) {
    throw new Error('TO_ACCOUNT_NOT_FOUND');
  }

  assertCurrencyCompatible(
    fromAccount.currency,
    toAccount.currency,
  );

  if (fromAccountId === existing.from_account_id) {
    // Akun asal tidak berubah: kembalikan saldo transfer lama agar
    // pengecekan saldo mencerminkan kondisi sebelum transfer ini.
    const balanceExcludingOldTransfer =
      fromAccount.current_balance.add(
        new Prisma.Decimal(existing.amount),
      );

    assertSufficientFunds(
      balanceExcludingOldTransfer,
      amount,
    );
  } else {
    assertSufficientFunds(
      fromAccount.current_balance,
      amount,
    );
  }

  await updateTransfer(
    transferId,
    {
      fromAccountId,
      toAccountId,
      amount: amount.toNumber(),
      transferDate: data.transfer_date
        ? new Date(data.transfer_date)
        : existing.transfer_date,
      note:
        data.note !== undefined
          ? data.note
          : (existing.note ?? null),
    },
    fromTransaction.id,
    toTransaction.id,
    userId,
  );

  return findTransferById(transferId, userId);
};

export const deleteTransferService = async (
  transferId: string,
  userId: string,
) => {
  const existing = await findTransferById(
    transferId,
    userId,
  );

  if (!existing) {
    throw new Error('TRANSFER_NOT_FOUND');
  }

  await deleteTransfer(
    transferId,
    existing
      .transactions_transfers_from_transaction_idTotransactions
      ?.id,
    existing
      .transactions_transfers_to_transaction_idTotransactions
      ?.id,
  );

  return true;
};