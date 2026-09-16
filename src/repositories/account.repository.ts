import { prisma } from '../config/database.js';
// import type { accounts_type } from '../generated/prisma/enums.js';
// import { prisma } from '../config/database.js';
import { Prisma } from '../generated/prisma/client.js';
import type { accounts_type } from '../generated/prisma/enums.js';
export const createAccount = async (data: {
  userId: string;
  name: string;
  type: accounts_type;
  initial_balance: number;
  currency: string;
}) => {
  return prisma.accounts.create({
    data: {
      user_id: data.userId,
      name: data.name,
      type: data.type,
      initial_balance: data.initial_balance,
      currency: data.currency,
    },
  });
};

export const findAccountsByUserId = async (
  userId: string,
  page: number,
  perPage: number,
) => {
  const skip = (page - 1) * perPage;

  const [data, total] = await prisma.$transaction([
    prisma.accounts.findMany({
      where: {
        user_id: userId,
      },
      orderBy: {
        created_at: 'desc',
      },
      skip,
      take: perPage,
    }),

    prisma.accounts.count({
      where: {
        user_id: userId,
      },
    }),
  ]);

  const balances = await getAccountBalances(
    userId,
    data.map((account) => account.id),
  );

  const accounts = data.map((account) => ({
    ...account,
    current_balance: new Prisma.Decimal(
      account.initial_balance,
    ).add(
      balances.get(account.id) ??
        new Prisma.Decimal(0),
    ),
  }));

  return {
    data: accounts,
    total,
    page,
    perPage,
  };
};

export const findAccountByIdAndUserId = async (
  accountId: string,
  userId: string,
) => {
  const account = await prisma.accounts.findFirst({
    where: {
      id: accountId,
      user_id: userId,
    },
  });

  if (!account) {
    return null;
  }

  const balances = await getAccountBalances(
    userId,
    [account.id],
  );

  return {
    ...account,
    current_balance: new Prisma.Decimal(
      account.initial_balance,
    ).add(
      balances.get(account.id) ??
        new Prisma.Decimal(0),
    ),
  };
};

export const updateAccount = async (
  accountId: string,
  userId: string,
  data: {
    name?: string;
    type?: accounts_type;
    currency?: string;
    is_active?: boolean;
  },
) => {
  return prisma.accounts.updateMany({
    where: {
      id: accountId,
      user_id: userId,
    },
    data,
  });
};

export const deleteAccount = async (
  accountId: string,
  userId: string,
) => {
  return prisma.accounts.deleteMany({
    where: {
      id: accountId,
      user_id: userId,
    },
  });
};

export const getAccountBalances = async (
  userId: string,
  accountIds: string[],
) => {
  if (accountIds.length === 0) {
    return new Map<string, Prisma.Decimal>();
  }

  const transactions = await prisma.transactions.groupBy({
    by: ['account_id', 'type'],
    where: {
      user_id: userId,
      account_id: {
        in: accountIds,
      },
      status: 'completed',
    },
    _sum: {
      amount: true,
    },
  });

  const balances = new Map<string, Prisma.Decimal>();

  for (const accountId of accountIds) {
    balances.set(
      accountId,
      new Prisma.Decimal(0),
    );
  }

  for (const transaction of transactions) {
    const currentBalance =
      balances.get(transaction.account_id) ??
      new Prisma.Decimal(0);

    const amount =
      transaction._sum.amount ??
      new Prisma.Decimal(0);

    let adjustment = new Prisma.Decimal(0);

    switch (transaction.type) {
      case 'income':
      case 'refund':
        adjustment = amount;
        break;
      case 'expense':
        adjustment = amount.negated();
        break;

      case 'adjustment':
        adjustment = amount;
        break;

      case 'transfer':
        // Transfer akan dikelola oleh module transfer.
        break;
    }

    balances.set(
      transaction.account_id,
      currentBalance.add(adjustment),
    );
  }

  return balances;
};