import type { Request, Response } from 'express';

import {
  createTransferService,
  deleteTransferService,
  getTransferService,
  getTransfersService,
  updateTransferService,
} from '../services/transfer.service.js';

import { getAuthenticatedUserId } from '../utils/auth.js';
import { fail, success } from '../utils/response.js';

const TRANSFER_ERRORS: Record<
  string,
  { status: number; message: string }
> = {
  FROM_ACCOUNT_NOT_FOUND: {
    status: 404,
    message: 'Akun asal tidak ditemukan',
  },
  TO_ACCOUNT_NOT_FOUND: {
    status: 404,
    message: 'Akun tujuan tidak ditemukan',
  },
  SAME_ACCOUNT: {
    status: 422,
    message: 'Akun asal dan akun tujuan tidak boleh sama',
  },
  CURRENCY_MISMATCH: {
    status: 422,
    message: 'Mata uang akun asal dan akun tujuan tidak sama',
  },
  INSUFFICIENT_FUNDS: {
    status: 422,
    message: 'Saldo akun asal tidak mencukupi',
  },
  TRANSFER_NOT_FOUND: {
    status: 404,
    message: 'Transfer tidak ditemukan',
  },
  TRANSFER_INVALID: {
    status: 409,
    message: 'Data transfer tidak lengkap atau sudah rusak',
  },
};

const handleTransferError = (
  res: Response,
  error: unknown,
  context: string,
) => {
  if (
    error instanceof Error &&
    TRANSFER_ERRORS[error.message]
  ) {
    const { status, message } =
      TRANSFER_ERRORS[error.message];

    return fail(res, status, message);
  }

  console.error(`${context}:`, error);

  return fail(
    res,
    500,
    'Terjadi kesalahan pada server',
  );
};

export const createTransferController = async (
  req: Request,
  res: Response,
) => {
  try {
    const userId = getAuthenticatedUserId(req);

    const result = await createTransferService(
      userId,
      req.body,
    );

    return success(
      res,
      201,
      'Transfer berhasil dibuat',
      { data: result.transfer },
    );
  } catch (error) {
    return handleTransferError(
      res,
      error,
      'Create transfer error',
    );
  }
};

export const getTransfersController = async (
  req: Request,
  res: Response,
) => {
  try {
    const userId = getAuthenticatedUserId(req);

    const transfers = await getTransfersService(userId);

    return success(
      res,
      200,
      'Data transfer berhasil diambil',
      { data: transfers },
    );
  } catch (error) {
    return handleTransferError(
      res,
      error,
      'Get transfers error',
    );
  }
};

export const getTransferController = async (
  req: Request,
  res: Response,
) => {
  try {
    const userId = getAuthenticatedUserId(req);

    const id = req.params.id as string;

    const transfer = await getTransferService(
      id,
      userId,
    );

    return success(
      res,
      200,
      'Data transfer berhasil diambil',
      { data: transfer },
    );
  } catch (error) {
    return handleTransferError(
      res,
      error,
      'Get transfer error',
    );
  }
};

export const updateTransferController = async (
  req: Request,
  res: Response,
) => {
  try {
    const userId = getAuthenticatedUserId(req);

    const id = req.params.id as string;

    await updateTransferService(
      id,
      userId,
      req.body,
    );

    return success(
      res,
      200,
      'Transfer berhasil diperbarui',
    );
  } catch (error) {
    return handleTransferError(
      res,
      error,
      'Update transfer error',
    );
  }
};

export const deleteTransferController = async (
  req: Request,
  res: Response,
) => {
  try {
    const userId = getAuthenticatedUserId(req);

    const id = req.params.id as string;

    await deleteTransferService(
      id,
      userId,
    );

    return success(
      res,
      200,
      'Transfer berhasil dihapus',
    );
  } catch (error) {
    return handleTransferError(
      res,
      error,
      'Delete transfer error',
    );
  }
};