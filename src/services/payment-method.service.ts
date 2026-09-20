import { prisma } from '../config/database.js';

import {
  clearDefaultPaymentMethods,
  createPaymentMethod,
  deactivatePaymentMethod,
  findAccountByIdAndUser,
  findPaymentMethodByIdAndUser,
  findPaymentMethodsByUser,
  updatePaymentMethod,
} from '../repositories/payment-method.repository.js';

import type {
  CreatePaymentMethodInput,
  UpdatePaymentMethodInput,
} from '../validators/payment-method.validator.js';

import type { payment_methods_type } from '../generated/prisma/enums.js';

const validateAccount = async (
  userId: string,
  accountId: string | null,
) => {
  if (!accountId) {
    return;
  }

  const account = await findAccountByIdAndUser(
    accountId,
    userId,
  );

  if (!account) {
    throw new Error('ACCOUNT_NOT_FOUND');
  }
};

export const create = async (
  userId: string,
  input: CreatePaymentMethodInput,
) => {
  const accountId = input.account_id ?? null;

  await validateAccount(userId, accountId);

  return prisma.$transaction(async (tx) => {
    if (input.is_default) {
      await clearDefaultPaymentMethods(userId, tx);
    }

    return createPaymentMethod(
      {
        userId,
        name: input.name,
        type: input.type,
        provider: input.provider ?? null,
        accountId,
        isDefault: input.is_default,
      },
      tx,
    );
  });
};

export const getAll = async (params: {
  userId: string;
  page: number;
  perPage: number;
  type?: payment_methods_type;
  search?: string;
  isActive?: boolean;
  isDefault?: boolean;
}) => {
  return findPaymentMethodsByUser(params);
};

export const getById = async (
  userId: string,
  methodId: string,
) => {
  const method = await findPaymentMethodByIdAndUser(
    methodId,
    userId,
  );

  if (!method) {
    throw new Error('PAYMENT_METHOD_NOT_FOUND');
  }

  return method;
};

export const update = async (
  userId: string,
  methodId: string,
  input: UpdatePaymentMethodInput,
) => {
  const method = await findPaymentMethodByIdAndUser(
    methodId,
    userId,
  );

  if (!method) {
    throw new Error('PAYMENT_METHOD_NOT_FOUND');
  }

  if (input.account_id !== undefined) {
    await validateAccount(userId, input.account_id);
  }

  const deactivating = input.is_active === false;
  const isDefault = deactivating
    ? false
    : (input.is_default ?? method.is_default);

  await prisma.$transaction(async (tx) => {
    if (isDefault) {
      await clearDefaultPaymentMethods(userId, tx);
    }

    await updatePaymentMethod(
      methodId,
      userId,
      {
        ...(input.name !== undefined
          ? { name: input.name }
          : {}),
        ...(input.type !== undefined
          ? { type: input.type }
          : {}),
        ...(input.provider !== undefined
          ? { provider: input.provider }
          : {}),
        ...(input.account_id !== undefined
          ? { account_id: input.account_id }
          : {}),
        ...(input.is_active !== undefined
          ? { is_active: input.is_active }
          : {}),
        is_default: isDefault,
      },
      tx,
    );
  });

  return findPaymentMethodByIdAndUser(methodId, userId);
};

export const remove = async (
  userId: string,
  methodId: string,
) => {
  const method = await findPaymentMethodByIdAndUser(
    methodId,
    userId,
  );

  if (!method) {
    throw new Error('PAYMENT_METHOD_NOT_FOUND');
  }

  await deactivatePaymentMethod(methodId, userId);

  return true;
};