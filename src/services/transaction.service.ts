import {
  createTransaction,
  findTransactionsByUser,
  findTransactionById,
  updateTransaction,
  deleteTransaction,
  findAccountByIdAndUser,
  findCategoryByIdAndUser,
} from '../repositories/transaction.repository.js';

import type {
  CreateTransactionInput,
  UpdateTransactionInput,
} from '../validators/transaction.validator.js';

export const createTransactionService = async (
  userId: string,
  data: CreateTransactionInput,
) => {
  // Pastikan account milik user yang sedang login.
  const account = await findAccountByIdAndUser(
    data.account_id,
    userId,
  );

  if (!account) {
    throw new Error('ACCOUNT_NOT_FOUND');
  }

  // Category tidak wajib.
  if (data.category_id) {
    const category = await findCategoryByIdAndUser(
      data.category_id,
      userId,
    );

    if (!category) {
      throw new Error('CATEGORY_NOT_FOUND');
    }

    // Pastikan tipe kategori sesuai dengan transaksi.
    if (
      data.type === 'income' &&
      category.type !== 'income'
    ) {
      throw new Error('INVALID_CATEGORY_TYPE');
    }

    if (
      data.type === 'expense' &&
      category.type !== 'expense'
    ) {
      throw new Error('INVALID_CATEGORY_TYPE');
    }

    if (
      data.type === 'refund' &&
      category.type !== 'income'
    ) {
      throw new Error('INVALID_CATEGORY_TYPE');
    }
  }

  return createTransaction({
    users: {
      connect: {
        id: userId,
      },
    },

    accounts: {
      connect: {
        id: data.account_id,
      },
    },

    ...(data.category_id
      ? {
          categories: {
            connect: {
              id: data.category_id,
            },
          },
        }
      : {}),

    type: data.type,
    amount: data.amount,
    transaction_date: new Date(data.transaction_date),
    description: data.description ?? null,
    merchant: data.merchant ?? null,
    reference_number: data.reference_number ?? null,

    // Jangan menerima status dari frontend.
    status: 'completed',
  });
};

export const getTransactionsService = async (
  userId: string,
) => {
  return findTransactionsByUser(userId);
};

export const getTransactionService = async (
  transactionId: string,
  userId: string,
) => {
  const transaction = await findTransactionById(
    transactionId,
    userId,
  );

  if (!transaction) {
    throw new Error('TRANSACTION_NOT_FOUND');
  }

  return transaction;
};

export const updateTransactionService = async (
  transactionId: string,
  userId: string,
  data: UpdateTransactionInput,
) => {
  const transaction = await findTransactionById(
    transactionId,
    userId,
  );

  if (!transaction) {
    throw new Error('TRANSACTION_NOT_FOUND');
  }

  if (data.category_id) {
    const category = await findCategoryByIdAndUser(
      data.category_id,
      userId,
    );

    if (!category) {
      throw new Error('CATEGORY_NOT_FOUND');
    }

    if (
      transaction.type === 'income' &&
      category.type !== 'income'
    ) {
      throw new Error('INVALID_CATEGORY_TYPE');
    }

    if (
      transaction.type === 'expense' &&
      category.type !== 'expense'
    ) {
      throw new Error('INVALID_CATEGORY_TYPE');
    }

    if (
      transaction.type === 'refund' &&
      category.type !== 'income'
    ) {
      throw new Error('INVALID_CATEGORY_TYPE');
    }
  }

  await updateTransaction(
    transactionId,
    userId,
    {
      ...(data.category_id !== undefined
        ? {
            categories: data.category_id
              ? {
                  connect: {
                    id: data.category_id,
                  },
                }
              : {
                  disconnect: true,
                },
          }
        : {}),

      ...(data.transaction_date !== undefined
        ? {
            transaction_date: new Date(
              data.transaction_date,
            ),
          }
        : {}),

      ...(data.description !== undefined
        ? {
            description: data.description,
          }
        : {}),

      ...(data.merchant !== undefined
        ? {
            merchant: data.merchant,
          }
        : {}),

      ...(data.reference_number !== undefined
        ? {
            reference_number: data.reference_number,
          }
        : {}),
    },
  );

  return findTransactionById(
    transactionId,
    userId,
  );
};

export const deleteTransactionService = async (
  transactionId: string,
  userId: string,
) => {
  const transaction = await findTransactionById(
    transactionId,
    userId,
  );

  if (!transaction) {
    throw new Error('TRANSACTION_NOT_FOUND');
  }

  // Transfer jangan dihapus melalui transaction biasa.
  if (transaction.type === 'transfer') {
    throw new Error('TRANSFER_TRANSACTION_NOT_ALLOWED');
  }

  await deleteTransaction(
    transactionId,
    userId,
  );

  return true;
};