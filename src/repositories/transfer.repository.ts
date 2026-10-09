import { prisma } from '../config/database.js';
import { Prisma } from '../generated/prisma/client.js';
import { accountRefSelect } from '../dtos/common.dto.js';

export interface TransferFilters {
  search?: string;
  fromAccountId?: string;
  toAccountId?: string;
  from?: Date;
  to?: Date;
  minAmount?: number;
  maxAmount?: number;
}

interface TransferWriteData {
  fromAccountId: string;
  toAccountId: string;
  amount: Prisma.Decimal;
  transferDate: Date;
  note: string | null;
  /** Deskripsi kaki transaksi keluar & masuk. */
  fromDescription: string;
  toDescription: string;
}

const transferInclude = {
  accounts_transfers_from_account_idToaccounts: { select: accountRefSelect },
  accounts_transfers_to_account_idToaccounts: { select: accountRefSelect },
} satisfies Prisma.transfersInclude;

/**
 * Kunci baris rekening (urut id agar tidak deadlock) supaya cek saldo
 * atomik terhadap transfer lain yang berjalan bersamaan, lalu kembalikan
 * data rekening yang ditemukan.
 */
export const lockAccounts = async (
  tx: Prisma.TransactionClient,
  userId: string,
  accountIds: string[],
) => {
  const ids = [...new Set(accountIds)].sort();

  await tx.$queryRaw`
    SELECT id FROM accounts
    WHERE user_id = ${userId} AND id IN (${Prisma.join(ids)})
    ORDER BY id
    FOR UPDATE
  `;

  const accounts = await tx.accounts.findMany({
    where: { user_id: userId, id: { in: ids } },
    select: {
      ...accountRefSelect,
      is_active: true,
      initial_balance: true,
    },
  });

  return new Map(accounts.map((account) => [account.id, account]));
};

/** Kunci baris transfer; `false` bila transfer tidak ditemukan. */
export const lockTransfer = async (
  tx: Prisma.TransactionClient,
  userId: string,
  transferId: string,
) => {
  const rows = await tx.$queryRaw<{ id: string }[]>`
    SELECT id FROM transfers
    WHERE id = ${transferId} AND user_id = ${userId}
    FOR UPDATE
  `;

  return rows.length > 0;
};

export const findTransfers = async (params: {
  userId: string;
  page: number;
  perPage: number;
  filters: TransferFilters;
}) => {
  const { filters } = params;
  const conditions: Prisma.transfersWhereInput[] = [
    { user_id: params.userId },
  ];

  if (filters.search) {
    conditions.push({ note: { contains: filters.search } });
  }

  if (filters.fromAccountId) {
    conditions.push({ from_account_id: filters.fromAccountId });
  }

  if (filters.toAccountId) {
    conditions.push({ to_account_id: filters.toAccountId });
  }

  if (filters.from || filters.to) {
    conditions.push({ transfer_date: { gte: filters.from, lte: filters.to } });
  }

  if (filters.minAmount !== undefined || filters.maxAmount !== undefined) {
    conditions.push({
      amount: { gte: filters.minAmount, lte: filters.maxAmount },
    });
  }

  const where: Prisma.transfersWhereInput = { AND: conditions };

  const [data, total] = await prisma.$transaction([
    prisma.transfers.findMany({
      where,
      include: transferInclude,
      orderBy: [{ transfer_date: 'desc' }, { created_at: 'desc' }],
      skip: (params.page - 1) * params.perPage,
      take: params.perPage,
    }),
    prisma.transfers.count({ where }),
  ]);

  return { data, total };
};

export const findTransferById = (
  transferId: string,
  userId: string,
  db: Prisma.TransactionClient = prisma,
) =>
  db.transfers.findFirst({
    where: { id: transferId, user_id: userId },
    include: transferInclude,
  });

export const createTransfer = async (
  tx: Prisma.TransactionClient,
  userId: string,
  data: TransferWriteData,
) => {
  const leg = (accountId: string, description: string) =>
    tx.transactions.create({
      data: {
        user_id: userId,
        account_id: accountId,
        type: 'transfer',
        status: 'completed',
        amount: data.amount,
        transaction_date: data.transferDate,
        description,
      },
      select: { id: true },
    });

  const fromTransaction = await leg(data.fromAccountId, data.fromDescription);
  const toTransaction = await leg(data.toAccountId, data.toDescription);

  return tx.transfers.create({
    data: {
      user_id: userId,
      from_account_id: data.fromAccountId,
      to_account_id: data.toAccountId,
      amount: data.amount,
      transfer_date: data.transferDate,
      note: data.note,
      from_transaction_id: fromTransaction.id,
      to_transaction_id: toTransaction.id,
    },
    include: transferInclude,
  });
};

export const updateTransfer = async (
  tx: Prisma.TransactionClient,
  transfer: {
    id: string;
    from_transaction_id: string;
    to_transaction_id: string;
  },
  data: TransferWriteData,
) => {
  const legData = {
    amount: data.amount,
    transaction_date: data.transferDate,
  };

  await tx.transactions.update({
    where: { id: transfer.from_transaction_id },
    data: {
      ...legData,
      account_id: data.fromAccountId,
      description: data.fromDescription,
    },
  });

  await tx.transactions.update({
    where: { id: transfer.to_transaction_id },
    data: {
      ...legData,
      account_id: data.toAccountId,
      description: data.toDescription,
    },
  });

  return tx.transfers.update({
    where: { id: transfer.id },
    data: {
      from_account_id: data.fromAccountId,
      to_account_id: data.toAccountId,
      amount: data.amount,
      transfer_date: data.transferDate,
      note: data.note,
    },
    include: transferInclude,
  });
};

export const deleteTransfer = async (
  tx: Prisma.TransactionClient,
  transfer: {
    id: string;
    from_transaction_id: string | null;
    to_transaction_id: string | null;
  },
) => {
  // Transfer dihapus lebih dulu karena mereferensikan kedua transaksinya.
  await tx.transfers.delete({ where: { id: transfer.id } });

  const legIds = [transfer.from_transaction_id, transfer.to_transaction_id]
    .filter((id): id is string => Boolean(id));

  if (legIds.length > 0) {
    await tx.transactions.deleteMany({ where: { id: { in: legIds } } });
  }
};

export const updateTransferProof = (
  transferId: string,
  proofUrl: string | null,
) =>
  prisma.transfers.update({
    where: { id: transferId },
    data: { proof_url: proofUrl },
    include: transferInclude,
  });
