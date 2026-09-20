import { prisma } from '../config/database.js';
import { Prisma } from '../generated/prisma/client.js';
import { getAccountBalances } from './account.repository.js';

export interface TransferFilters {
  search?: string;
  fromAccountId?: string;
  toAccountId?: string;
  from?: Date;
  to?: Date;
  minAmount?: number;
  maxAmount?: number;
}

const lockAccounts = async (
  tx: Prisma.TransactionClient,
  userId: string,
  accountIds: string[],
) => {
  const sortedIds = [...accountIds].sort();

  for (const id of sortedIds) {
    await tx.$queryRaw`SELECT id FROM accounts WHERE id = ${id} AND user_id = ${userId} FOR UPDATE`;
  }
};

export interface CreateTransferData {
  userId: string;
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  transferDate: Date;
  note?: string | null;
}

export interface UpdateTransferData {
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  transferDate: Date;
  note: string | null;
}

export const findAccountByIdAndUser = async (
  accountId: string,
  userId: string,
) => {
  const account = await prisma.accounts.findFirst({
    where: {
      id: accountId,
      user_id: userId,
      is_active: true,
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

export const createTransfer = async (
  data: CreateTransferData,
) => {
  return prisma.$transaction(async (tx) => {
    // Kunci baris akun agar pengecekan saldo atomic terhadap
    // transfer/transaksi lain yang berjalan bersamaan.
    await lockAccounts(
      tx,
      data.userId,
      [data.fromAccountId, data.toAccountId],
    );

    const fromAccountRow = await tx.accounts.findUnique({
      where: {
        id: data.fromAccountId,
      },
      select: {
        initial_balance: true,
      },
    });

    const transactionsSum =
      (await getAccountBalances(
        data.userId,
        [data.fromAccountId],
        tx,
      )).get(data.fromAccountId) ?? new Prisma.Decimal(0);

    const fromBalance = transactionsSum.add(
      new Prisma.Decimal(
        fromAccountRow?.initial_balance ?? 0,
      ),
    );

    if (
      fromBalance.lessThan(
        new Prisma.Decimal(data.amount),
      )
    ) {
      throw new Error('INSUFFICIENT_FUNDS');
    }

    const fromTransaction = await tx.transactions.create({
      data: {
        users: {
          connect: {
            id: data.userId,
          },
        },
        accounts: {
          connect: {
            id: data.fromAccountId,
          },
        },
        type: 'transfer',
        status: 'completed',
        amount: data.amount,
        transaction_date: data.transferDate,
        description: data.note ?? null,
      },
    });

    const toTransaction = await tx.transactions.create({
      data: {
        users: {
          connect: {
            id: data.userId,
          },
        },
        accounts: {
          connect: {
            id: data.toAccountId,
          },
        },
        type: 'transfer',
        status: 'completed',
        amount: data.amount,
        transaction_date: data.transferDate,
        description: data.note ?? null,
      },
    });

    const transfer = await tx.transfers.create({
      data: {
        users: {
          connect: {
            id: data.userId,
          },
        },
        accounts_transfers_from_account_idToaccounts: {
          connect: {
            id: data.fromAccountId,
          },
        },
        accounts_transfers_to_account_idToaccounts: {
          connect: {
            id: data.toAccountId,
          },
        },
        amount: data.amount,
        transfer_date: data.transferDate,
        note: data.note ?? null,
        transactions_transfers_from_transaction_idTotransactions: {
          connect: {
            id: fromTransaction.id,
          },
        },
        transactions_transfers_to_transaction_idTotransactions: {
          connect: {
            id: toTransaction.id,
          },
        },
      },
      include: {
        accounts_transfers_from_account_idToaccounts: {
          select: {
            id: true,
            name: true,
            type: true,
            currency: true,
          },
        },
        accounts_transfers_to_account_idToaccounts: {
          select: {
            id: true,
            name: true,
            type: true,
            currency: true,
          },
        },
      },
    });

    return {
      transfer,
      fromTransaction,
      toTransaction,
    };
  });
};
export const findTransfersByUser = async (params: {
  userId: string;
  page: number;
  perPage: number;
  filters?: TransferFilters;
}) => {
  const skip = (params.page - 1) * params.perPage;
  const filters = params.filters ?? {};

  const include = {
    accounts_transfers_from_account_idToaccounts: {
      select: {
        id: true,
        name: true,
        type: true,
        currency: true,
      },
    },
    accounts_transfers_to_account_idToaccounts: {
      select: {
        id: true,
        name: true,
        type: true,
        currency: true,
      },
    },
  };

  const conditions: Prisma.transfersWhereInput[] = [
    {
      user_id: params.userId,
    },
  ];

  if (filters.search) {
    conditions.push({
      note: {
        contains: filters.search,
      },
    });
  }

  if (filters.fromAccountId) {
    conditions.push({
      from_account_id: filters.fromAccountId,
    });
  }

  if (filters.toAccountId) {
    conditions.push({
      to_account_id: filters.toAccountId,
    });
  }

  if (filters.from || filters.to) {
    conditions.push({
      transfer_date: {
        ...(filters.from ? { gte: filters.from } : {}),
        ...(filters.to ? { lte: filters.to } : {}),
      },
    });
  }

  if (
    filters.minAmount !== undefined ||
    filters.maxAmount !== undefined
  ) {
    conditions.push({
      amount: {
        ...(filters.minAmount !== undefined
          ? { gte: filters.minAmount }
          : {}),
        ...(filters.maxAmount !== undefined
          ? { lte: filters.maxAmount }
          : {}),
      },
    });
  }

  const where: Prisma.transfersWhereInput = {
    AND: conditions,
  };

  const [data, total] = await prisma.$transaction([
    prisma.transfers.findMany({
      where,
      orderBy: [
        {
          transfer_date: 'desc',
        },
        {
          created_at: 'desc',
        },
      ],
      skip,
      take: params.perPage,
      include,
    }),

    prisma.transfers.count({
      where,
    }),
  ]);

  return {
    data,
    total,
  };
};

export const findTransferById = async (
  transferId: string,
  userId: string,
) => {
  return prisma.transfers.findFirst({
    where: {
      id: transferId,
      user_id: userId,
    },
    include: {
      accounts_transfers_from_account_idToaccounts: {
        select: {
          id: true,
          name: true,
          type: true,
          currency: true,
        },
      },
      accounts_transfers_to_account_idToaccounts: {
        select: {
          id: true,
          name: true,
          type: true,
          currency: true,
        },
      },
      transactions_transfers_from_transaction_idTotransactions: {
        select: {
          id: true,
          account_id: true,
          type: true,
          status: true,
          amount: true,
          transaction_date: true,
          description: true,
        },
      },
      transactions_transfers_to_transaction_idTotransactions: {
        select: {
          id: true,
          account_id: true,
          type: true,
          status: true,
          amount: true,
          transaction_date: true,
          description: true,
        },
      },
    },
  });
};

export const updateTransfer = async (
  transferId: string,
  data: UpdateTransferData,
  fromTransactionId: string,
  toTransactionId: string,
  userId: string,
) => {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.transfers.findUnique({
      where: {
        id: transferId,
      },
      select: {
        from_account_id: true,
        amount: true,
      },
    });

    if (!existing) {
      throw new Error('TRANSFER_NOT_FOUND');
    }

    // Kunci baris akun agar pengecekan saldo atomic.
    await lockAccounts(
      tx,
      userId,
      [data.fromAccountId, data.toAccountId],
    );

    const fromAccountRow = await tx.accounts.findUnique({
      where: {
        id: data.fromAccountId,
      },
      select: {
        initial_balance: true,
      },
    });

    const transactionsSum =
      (await getAccountBalances(
        userId,
        [data.fromAccountId],
        tx,
      )).get(data.fromAccountId) ?? new Prisma.Decimal(0);

    const fromBalance = transactionsSum.add(
      new Prisma.Decimal(
        fromAccountRow?.initial_balance ?? 0,
      ),
    );

    // Jika akun asal tidak berubah, saldo saat ini sudah termasuk
    // pengurangan transfer lama, jadi kembalikan dulu untuk dicek.
    const available = existing.from_account_id === data.fromAccountId
      ? fromBalance.add(new Prisma.Decimal(existing.amount))
      : fromBalance;

    if (available.lessThan(new Prisma.Decimal(data.amount))) {
      throw new Error('INSUFFICIENT_FUNDS');
    }

    const transactionUpdate: Prisma.transactionsUncheckedUpdateInput = {
      amount: data.amount,
      transaction_date: data.transferDate,
      description: data.note,
    };

    await tx.transactions.update({
      where: {
        id: fromTransactionId,
      },
      data: {
        ...transactionUpdate,
        account_id: data.fromAccountId,
      },
    });

    await tx.transactions.update({
      where: {
        id: toTransactionId,
      },
      data: {
        ...transactionUpdate,
        account_id: data.toAccountId,
      },
    });

    return tx.transfers.update({
      where: {
        id: transferId,
      },
      data: {
        from_account_id: data.fromAccountId,
        to_account_id: data.toAccountId,
        amount: data.amount,
        transfer_date: data.transferDate,
        note: data.note,
      },
      include: {
        accounts_transfers_from_account_idToaccounts: {
          select: {
            id: true,
            name: true,
            type: true,
            currency: true,
          },
        },
        accounts_transfers_to_account_idToaccounts: {
          select: {
            id: true,
            name: true,
            type: true,
            currency: true,
          },
        },
      },
    });
  });
};

export const deleteTransfer = async (
  transferId: string,
  fromTransactionId?: string,
  toTransactionId?: string,
) => {
  return prisma.$transaction(async (tx) => {
    // Hapus transfer dulu karena transfers mereferensikan transaksi (FK).
    await tx.transfers.delete({
      where: {
        id: transferId,
      },
    });

    const transactionIds = [
      fromTransactionId,
      toTransactionId,
    ].filter((id): id is string => Boolean(id));

    if (transactionIds.length > 0) {
      await tx.transactions.deleteMany({
        where: {
          id: {
            in: transactionIds,
          },
        },
      });
    }
  });
};