import { Prisma } from '../generated/prisma/client.js';
import {
  createAccount as insertAccount,
  deleteAccount as removeAccount,
  findAccountById,
  findAccounts,
  getAccountBalances,
  hasAccountActivity,
  isAccountReferenced,
  updateAccount as saveAccount,
  type AccountFilters,
} from '../repositories/account.repository.js';
import { conflict, notFound, unprocessable } from '../utils/app-error.js';
import type { PaginationParams } from '../utils/pagination.js';
import type {
  CreateAccountInput,
  UpdateAccountInput,
} from '../validators/account.validator.js';

type AccountRow = NonNullable<Awaited<ReturnType<typeof findAccountById>>>;

const withBalances = async (userId: string, accounts: AccountRow[]) => {
  const balances = await getAccountBalances(
    userId,
    accounts.map((account) => account.id),
  );

  return accounts.map((account) => ({
    ...account,
    current_balance: account.initial_balance.add(
      balances.get(account.id) ?? 0,
    ),
  }));
};

const requireAccount = async (userId: string, accountId: string) => {
  const account = await findAccountById(accountId, userId);

  if (!account) {
    throw notFound('ACCOUNT_NOT_FOUND', 'Rekening tidak ditemukan');
  }

  return account;
};

export const listAccounts = async (
  userId: string,
  pagination: PaginationParams,
  filters: AccountFilters,
) => {
  const result = await findAccounts({ userId, ...pagination, filters });

  return {
    data: await withBalances(userId, result.data),
    total: result.total,
  };
};

export const getAccount = async (userId: string, accountId: string) => {
  const account = await requireAccount(userId, accountId);

  return (await withBalances(userId, [account]))[0];
};

export const createAccount = async (
  userId: string,
  input: CreateAccountInput,
) => {
  const account = await insertAccount({
    user_id: userId,
    name: input.name,
    type: input.type,
    initial_balance: input.initial_balance,
    currency: input.currency,
    institution_name: input.institution_name ?? null,
    account_number_masked: input.account_number_masked ?? null,
    include_in_total_balance: input.include_in_total_balance,
  });

  return { ...account, current_balance: account.initial_balance };
};

export const updateAccount = async (
  userId: string,
  accountId: string,
  input: UpdateAccountInput,
) => {
  const account = await requireAccount(userId, accountId);

  const type = input.type ?? account.type;
  const initialBalance = new Prisma.Decimal(
    input.initial_balance ?? account.initial_balance,
  );

  if (type !== 'credit_card' && initialBalance.isNegative()) {
    throw unprocessable(
      'NEGATIVE_INITIAL_BALANCE',
      'Saldo awal tidak boleh negatif kecuali kartu kredit',
    );
  }

  if (
    input.currency !== undefined &&
    input.currency !== account.currency &&
    (await hasAccountActivity(accountId))
  ) {
    throw conflict(
      'ACCOUNT_CURRENCY_LOCKED',
      'Mata uang tidak bisa diubah karena rekening sudah memiliki transaksi',
    );
  }

  const data: Prisma.accountsUpdateInput = {};

  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) {
      (data as Record<string, unknown>)[key] = value;
    }
  }

  const updated = await saveAccount(accountId, data);

  return (await withBalances(userId, [updated]))[0];
};

/**
 * Rekening yang belum pernah dipakai dihapus permanen. Rekening yang
 * sudah direferensikan hanya diarsipkan agar riwayat tetap utuh.
 * Mengembalikan `true` bila rekening diarsipkan.
 */
export const deleteAccount = async (userId: string, accountId: string) => {
  await requireAccount(userId, accountId);

  if (await isAccountReferenced(accountId)) {
    await saveAccount(accountId, {
      is_active: false,
      include_in_total_balance: false,
    });

    return { archived: true };
  }

  await removeAccount(accountId);

  return { archived: false };
};
