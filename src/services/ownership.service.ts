import { prisma } from '../config/database.js';
import { notFound } from '../utils/app-error.js';

/**
 * Validasi kepemilikan resource keuangan pribadi yang dipakai lintas
 * modul (transaksi, patungan, tabungan, transaksi berulang).
 */

export const requireOwnedAccount = async (
  accountId: string,
  userId: string,
) => {
  const account = await prisma.accounts.findFirst({
    where: { id: accountId, user_id: userId, is_active: true },
    select: { id: true, name: true, currency: true },
  });

  if (!account) {
    throw notFound('ACCOUNT_NOT_FOUND', 'Rekening tidak ditemukan');
  }

  return account;
};

/** Kategori milik user atau kategori bawaan sistem. */
export const requireUsableCategory = async (
  categoryId: string,
  userId: string,
) => {
  const category = await prisma.categories.findFirst({
    where: {
      id: categoryId,
      OR: [{ user_id: userId }, { is_system: true }],
    },
    select: { id: true, name: true, type: true },
  });

  if (!category) {
    throw notFound('CATEGORY_NOT_FOUND', 'Kategori tidak ditemukan');
  }

  return category;
};

export interface FundingSourceInput {
  account_id?: string | null;
  payment_method_id?: string | null;
}

export interface FundingSource {
  accountId: string | null;
  paymentMethodId: string | null;
}

/**
 * Sumber dana sebuah pembayaran: rekening langsung, atau metode bayar
 * (yang boleh tertaut ke rekening). Bila keduanya dikirim, rekening
 * yang dipilih eksplisit yang dipakai untuk pencatatan saldo.
 */
export const resolveFundingSource = async (
  ownerId: string,
  input: FundingSourceInput,
): Promise<FundingSource> => {
  let accountId: string | null = null;
  let paymentMethodId: string | null = null;

  if (input.payment_method_id) {
    const method = await prisma.payment_methods.findFirst({
      where: {
        id: input.payment_method_id,
        user_id: ownerId,
        is_active: true,
      },
      select: { id: true, account_id: true },
    });

    if (!method) {
      throw notFound(
        'PAYMENT_METHOD_NOT_FOUND',
        'Metode pembayaran tidak ditemukan',
      );
    }

    paymentMethodId = method.id;
    accountId = method.account_id;
  }

  if (input.account_id) {
    accountId = (await requireOwnedAccount(input.account_id, ownerId)).id;
  }

  return { accountId, paymentMethodId };
};
