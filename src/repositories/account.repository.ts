import { prisma } from '../config/database.js';
import { Prisma } from '../generated/prisma/client.js';
import type { accounts_type } from '../generated/prisma/enums.js';

export interface AccountFilters {
  search?: string;
  type?: accounts_type;
  isActive?: boolean;
}

export const createAccount = (data: Prisma.accountsUncheckedCreateInput) =>
  prisma.accounts.create({ data });

export const findAccounts = async (params: {
  userId: string;
  page: number;
  perPage: number;
  filters: AccountFilters;
}) => {
  const { search, type, isActive } = params.filters;

  const where: Prisma.accountsWhereInput = {
    user_id: params.userId,
    is_active: isActive ?? true,
    ...(type ? { type } : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search } },
            { institution_name: { contains: search } },
            { account_number_masked: { contains: search } },
          ],
        }
      : {}),
  };

  const [data, total] = await prisma.$transaction([
    prisma.accounts.findMany({
      where,
      orderBy: [{ name: 'asc' }, { created_at: 'desc' }],
      skip: (params.page - 1) * params.perPage,
      take: params.perPage,
    }),
    prisma.accounts.count({ where }),
  ]);

  return { data, total };
};

export const findAccountById = (accountId: string, userId: string) =>
  prisma.accounts.findFirst({
    where: { id: accountId, user_id: userId },
  });

export const updateAccount = (
  accountId: string,
  data: Prisma.accountsUpdateInput,
) =>
  prisma.accounts.update({
    where: { id: accountId },
    data,
  });

export const deleteAccount = (accountId: string) =>
  prisma.accounts.delete({ where: { id: accountId } });

/** Rekening sudah punya mutasi saldo (transaksi atau transfer). */
export const hasAccountActivity = async (accountId: string) => {
  const [transaction, transfer] = await Promise.all([
    prisma.transactions.findFirst({
      where: { account_id: accountId },
      select: { id: true },
    }),
    prisma.transfers.findFirst({
      where: {
        OR: [{ from_account_id: accountId }, { to_account_id: accountId }],
      },
      select: { id: true },
    }),
  ]);

  return Boolean(transaction || transfer);
};

/** Rekening direferensikan data lain sehingga tidak boleh dihapus permanen. */
export const isAccountReferenced = async (accountId: string) => {
  if (await hasAccountActivity(accountId)) {
    return true;
  }

  const where = { account_id: accountId };
  const select = { id: true };

  const references = await Promise.all([
    prisma.payment_methods.findFirst({ where, select }),
    prisma.expense_payments.findFirst({ where, select }),
    prisma.settlements.findFirst({ where, select }),
    prisma.recurring_transactions.findFirst({ where, select }),
    prisma.savings_contributions.findFirst({ where, select }),
  ]);

  return references.some(Boolean);
};

/**
 * Perubahan saldo tiap rekening dari transaksi `completed`, TANPA
 * initial_balance. Arah transaksi transfer ditentukan dari tabel
 * transfers: kaki `from_transaction_id` mengurangi saldo, kaki
 * `to_transaction_id` menambah saldo. Adjustment memakai tanda nominalnya.
 */
export const getAccountBalances = async (
  userId: string,
  accountIds: string[],
  db: Prisma.TransactionClient = prisma,
): Promise<Map<string, Prisma.Decimal>> => {
  const balances = new Map<string, Prisma.Decimal>(
    accountIds.map((id) => [id, new Prisma.Decimal(0)]),
  );

  if (accountIds.length === 0) {
    return balances;
  }

  const rows = await db.$queryRaw<
    { account_id: string; delta: { toString(): string } | null }[]
  >`
    SELECT t.account_id,
      SUM(
        CASE
          WHEN t.type = 'expense' THEN -t.amount
          WHEN t.type <> 'transfer' THEN t.amount
          WHEN EXISTS (
            SELECT 1 FROM transfers tf WHERE tf.from_transaction_id = t.id
          ) THEN -t.amount
          WHEN EXISTS (
            SELECT 1 FROM transfers tf WHERE tf.to_transaction_id = t.id
          ) THEN t.amount
          ELSE 0
        END
      ) AS delta
    FROM transactions t
    WHERE t.user_id = ${userId}
      AND t.status = 'completed'
      AND t.account_id IN (${Prisma.join(accountIds)})
    GROUP BY t.account_id
  `;

  for (const row of rows) {
    balances.set(
      row.account_id,
      new Prisma.Decimal(row.delta?.toString() ?? '0'),
    );
  }

  return balances;
};
