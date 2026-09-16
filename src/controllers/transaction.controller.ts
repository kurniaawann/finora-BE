import type { Request, Response } from 'express';

import {
  createTransactionService,
  getTransactionsService,
  getTransactionService,
  updateTransactionService,
  deleteTransactionService,
} from '../services/transaction.service.js';

import { getAuthenticatedUserId } from '../utils/auth.js';

export const createTransactionController = async (
  req: Request,
  res: Response,
) => {
  try {
    const userId = getAuthenticatedUserId(req);

    const transaction =
      await createTransactionService(
        userId,
        req.body,
      );

    return res.status(201).json({
      success: true,
      message: 'Transaksi berhasil dibuat',
      data: transaction,
    });
  } catch (error) {
    if (error instanceof Error) {
      switch (error.message) {
        case 'ACCOUNT_NOT_FOUND':
          return res.status(404).json({
            success: false,
            message: 'Akun tidak ditemukan',
          });

        case 'CATEGORY_NOT_FOUND':
          return res.status(404).json({
            success: false,
            message: 'Kategori tidak ditemukan',
          });

        case 'INVALID_CATEGORY_TYPE':
          return res.status(422).json({
            success: false,
            message:
              'Tipe kategori tidak sesuai dengan tipe transaksi',
          });
      }
    }

    console.error(
      'Create transaction error:',
      error,
    );

    return res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan pada server',
    });
  }
};

export const getTransactionsController = async (
  req: Request,
  res: Response,
) => {
  try {
    const userId = getAuthenticatedUserId(req);

    const transactions =
      await getTransactionsService(userId);

    return res.status(200).json({
      success: true,
      message: 'Data transaksi berhasil diambil',
      data: transactions,
    });
  } catch (error) {
    console.error(
      'Get transactions error:',
      error,
    );

    return res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan pada server',
    });
  }
};

export const getTransactionController = async (
  req: Request,
  res: Response,
) => {
  try {
    const userId = getAuthenticatedUserId(req);

    const id = req.params.id as string;

    const transaction =
      await getTransactionService(id, userId);

    return res.status(200).json({
      success: true,
      message: 'Data transaksi berhasil diambil',
      data: transaction,
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === 'TRANSACTION_NOT_FOUND'
    ) {
      return res.status(404).json({
        success: false,
        message: 'Transaksi tidak ditemukan',
      });
    }

    console.error(
      'Get transaction error:',
      error,
    );

    return res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan pada server',
    });
  }
};

export const updateTransactionController = async (
  req: Request,
  res: Response,
) => {
  try {
    const userId = getAuthenticatedUserId(req);

    const id = req.params.id as string;

    const transaction =
      await updateTransactionService(
        id,
        userId,
        req.body,
      );

    return res.status(200).json({
      success: true,
      message: 'Transaksi berhasil diperbarui',
      data: transaction,
    });
  } catch (error) {
    if (error instanceof Error) {
      switch (error.message) {
        case 'TRANSACTION_NOT_FOUND':
          return res.status(404).json({
            success: false,
            message: 'Transaksi tidak ditemukan',
          });

        case 'CATEGORY_NOT_FOUND':
          return res.status(404).json({
            success: false,
            message: 'Kategori tidak ditemukan',
          });

        case 'INVALID_CATEGORY_TYPE':
          return res.status(422).json({
            success: false,
            message:
              'Tipe kategori tidak sesuai dengan tipe transaksi',
          });
      }
    }

    console.error(
      'Update transaction error:',
      error,
    );

    return res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan pada server',
    });
  }
};

export const deleteTransactionController = async (
  req: Request,
  res: Response,
) => {
  try {
    const userId = getAuthenticatedUserId(req);

    const id = req.params.id as string;

    await deleteTransactionService(
      id,
      userId,
    );

    return res.status(200).json({
      success: true,
      message: 'Transaksi berhasil dihapus',
    });
  } catch (error) {
    if (error instanceof Error) {
      switch (error.message) {
        case 'TRANSACTION_NOT_FOUND':
          return res.status(404).json({
            success: false,
            message: 'Transaksi tidak ditemukan',
          });

        case 'TRANSFER_TRANSACTION_NOT_ALLOWED':
          return res.status(422).json({
            success: false,
            message:
              'Transaksi transfer harus dikelola melalui fitur transfer',
          });
      }
    }

    console.error(
      'Delete transaction error:',
      error,
    );

    return res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan pada server',
    });
  }
};