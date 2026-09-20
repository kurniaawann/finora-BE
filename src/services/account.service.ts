import {
  createAccount,
  findAccountByIdAndUserId,
  findAccountsByUserId,
  updateAccount,
} from '../repositories/account.repository.js';

import type {
  CreateAccountInput,
  UpdateAccountInput,
} from '../validators/account.validator.js';

import type { accounts_type } from '../generated/prisma/enums.js';

export interface AccountFilters {
  search?: string;
  type?: accounts_type;
  isActive?: boolean;
}

export const create = async (
  userId: string,
  input: CreateAccountInput,
) => {
  return createAccount({
    userId,
    name: input.name,
    type: input.type,
    initial_balance: input.initial_balance,
    currency: input.currency,
  });
};

export const getAll = async (
  userId: string,
  page: number,
  perPage: number,
  filters: AccountFilters = {},
) => {
  return findAccountsByUserId({
    userId,
    page,
    perPage,
    ...filters,
  });
};

export const getById = async (
  userId: string,
  accountId: string,
) => {
  const account = await findAccountByIdAndUserId(
    accountId,
    userId,
  );

  if (!account) {
    throw new Error('ACCOUNT_NOT_FOUND');
  }

  return account;
};

export const update = async (
  userId: string,
  accountId: string,
  input: UpdateAccountInput,
) => {
  const account = await findAccountByIdAndUserId(
    accountId,
    userId,
  );

  if (!account) {
    throw new Error('ACCOUNT_NOT_FOUND');
  }

  await updateAccount(
    accountId,
    userId,
    input,
  );

  return findAccountByIdAndUserId(
    accountId,
    userId,
  );
};

export const remove = async (
  userId: string,
  accountId: string,
) => {
  const account = await findAccountByIdAndUserId(
    accountId,
    userId,
  );

  if (!account) {
    throw new Error('ACCOUNT_NOT_FOUND');
  }

  // Soft delete: akun dinonaktifkan dan tidak dihitung lagi
  // dalam total saldo, agar history transaksi tetap terjaga.
  await updateAccount(
    accountId,
    userId,
    {
      is_active: false,
      include_in_total_balance: false,
    },
  );

  return true;
};