import {
  countAccountReferences,
  createAccount,
  deleteAccount,
  findAccountByIdAndUserId,
  findAccountsByUserId,
  updateAccount,
} from '../repositories/account.repository.js';

import type {
  CreateAccountInput,
  UpdateAccountInput,
} from '../validators/account.validator.js';

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
) => {
  return findAccountsByUserId(userId, page, perPage);
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

  const references = await countAccountReferences(
    accountId,
  );

  if (references > 0) {
    throw new Error('ACCOUNT_HAS_RELATED_DATA');
  }

  await deleteAccount(accountId, userId);

  return true;
};