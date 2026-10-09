import { prisma } from '../config/database.js';
import {
  clearDefaultPaymentMethods,
  countActivePaymentMethods,
  countPaymentMethodUsage,
  createPaymentMethod,
  deletePaymentMethod,
  findPaymentMethodById,
  findPaymentMethods,
  type PaymentMethodFilters,
  updatePaymentMethod,
} from '../repositories/payment-method.repository.js';
import { notFound, unprocessable } from '../utils/app-error.js';
import type { PaginationParams } from '../utils/pagination.js';
import type {
  CreatePaymentMethodInput,
  UpdatePaymentMethodInput,
} from '../validators/payment-method.validator.js';
import { requireOwnedAccount } from './ownership.service.js';

const requirePaymentMethod = async (userId: string, methodId: string) => {
  const method = await findPaymentMethodById(methodId, userId);

  if (!method) {
    throw notFound(
      'PAYMENT_METHOD_NOT_FOUND',
      'Metode pembayaran tidak ditemukan',
    );
  }

  return method;
};

/** `undefined` = tidak diubah, `null` = lepas tautan rekening. */
const resolveAccountId = async (
  userId: string,
  accountId: string | null | undefined,
) => {
  if (!accountId) {
    return accountId;
  }

  return (await requireOwnedAccount(accountId, userId)).id;
};

export const listPaymentMethods = (
  userId: string,
  pagination: PaginationParams,
  filters: PaymentMethodFilters,
) => findPaymentMethods(userId, pagination, filters);

export const getPaymentMethod = (userId: string, methodId: string) =>
  requirePaymentMethod(userId, methodId);

export const addPaymentMethod = async (
  userId: string,
  input: CreatePaymentMethodInput,
) => {
  const accountId = await resolveAccountId(userId, input.account_id);

  return prisma.$transaction(async (tx) => {
    // Metode aktif pertama milik user otomatis menjadi default.
    const isDefault =
      input.is_default === true ||
      (await countActivePaymentMethods(userId, tx)) === 0;

    if (isDefault) {
      await clearDefaultPaymentMethods(userId, tx);
    }

    return createPaymentMethod(
      {
        user_id: userId,
        name: input.name,
        type: input.type,
        provider: input.provider ?? null,
        account_id: accountId ?? null,
        is_default: isDefault,
      },
      tx,
    );
  });
};

export const editPaymentMethod = async (
  userId: string,
  methodId: string,
  input: UpdatePaymentMethodInput,
) => {
  const method = await requirePaymentMethod(userId, methodId);
  const accountId = await resolveAccountId(userId, input.account_id);
  const isActive = input.is_active ?? method.is_active;

  if (input.is_default === true && !isActive) {
    throw unprocessable(
      'PAYMENT_METHOD_INACTIVE',
      'Metode pembayaran nonaktif tidak bisa dijadikan default',
    );
  }

  // Metode yang dinonaktifkan otomatis kehilangan status default.
  const isDefault = isActive && (input.is_default ?? method.is_default);

  return prisma.$transaction(async (tx) => {
    if (isDefault) {
      await clearDefaultPaymentMethods(userId, tx, methodId);
    }

    return updatePaymentMethod(
      methodId,
      {
        name: input.name,
        type: input.type,
        provider: input.provider,
        account_id: accountId,
        is_active: isActive,
        is_default: isDefault,
      },
      tx,
    );
  });
};

/**
 * Metode yang sudah tercatat di pembayaran patungan, pelunasan, atau
 * setoran tabungan hanya dinonaktifkan agar riwayatnya tetap utuh;
 * yang belum pernah dipakai dihapus permanen.
 */
export const removePaymentMethod = async (
  userId: string,
  methodId: string,
): Promise<{ archived: boolean }> => {
  await requirePaymentMethod(userId, methodId);

  return prisma.$transaction(async (tx) => {
    if ((await countPaymentMethodUsage(methodId, tx)) > 0) {
      await updatePaymentMethod(
        methodId,
        { is_active: false, is_default: false },
        tx,
      );

      return { archived: true };
    }

    await deletePaymentMethod(methodId, tx);

    return { archived: false };
  });
};
