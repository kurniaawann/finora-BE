import type { Request, Response } from 'express';

import {
  create,
  getAll,
  getById,
  remove,
  update,
} from '../services/account.service.js';

import { getAuthenticatedUserId } from '../utils/auth.js';
import {
  buildPaginationMeta,
  parsePagination,
} from '../utils/pagination.js';

export const createAccountController = async (
  req: Request,
  res: Response,
) => {
  try {
    const userId = getAuthenticatedUserId(req);

    const account = await create(
      userId,
      req.body,
    );

    return res.status(201).json({
      success: true,
      message: 'Account berhasil dibuat',
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: 'Gagal membuat account',
    });
  }
};

export const getAccountsController = async (
  req: Request,
  res: Response,
) => {
  try {
    const userId = getAuthenticatedUserId(req);

    const { page, perPage } = parsePagination(
      req.query,
    );

    const result = await getAll(userId, page, perPage);

    return res.status(200).json({
      success: true,
      data: result.data,
      pagination: buildPaginationMeta(
        { page, perPage },
        result.total,
      ),
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: 'Gagal mengambil account',
    });
  }
};

export const getAccountController = async (
  req: Request,
  res: Response,
) => {
  try {
    const userId = getAuthenticatedUserId(req);
    const accountId = req.params.id as string;

    const account = await getById(
      userId,
      accountId,
    );

    return res.status(200).json({
      success: true,
      data: account,
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === 'ACCOUNT_NOT_FOUND'
    ) {
      return res.status(404).json({
        success: false,
        message: 'Account tidak ditemukan',
      });
    }

    console.error(error);

    return res.status(500).json({
      success: false,
      message: 'Gagal mengambil account',
    });
  }
};

export const updateAccountController = async (
  req: Request,
  res: Response,
) => {
  try {
    const userId = getAuthenticatedUserId(req);
    const accountId = req.params.id as string;

    const account = await update(
      userId,
      accountId,
      req.body,
    );

    return res.status(200).json({
      success: true,
      message: 'Account berhasil diperbarui',
      data: account,
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === 'ACCOUNT_NOT_FOUND'
    ) {
      return res.status(404).json({
        success: false,
        message: 'Account tidak ditemukan',
      });
    }

    console.error(error);

    return res.status(500).json({
      success: false,
      message: 'Gagal memperbarui account',
    });
  }
};

export const deleteAccountController = async (
  req: Request,
  res: Response,
) => {
  try {
    const userId = getAuthenticatedUserId(req);
    const accountId = req.params.id as string;

    await remove(
      userId,
      accountId,
    );

    return res.status(200).json({
      success: true,
      message: 'Account berhasil dihapus',
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === 'ACCOUNT_NOT_FOUND'
    ) {
      return res.status(404).json({
        success: false,
        message: 'Account tidak ditemukan',
      });
    }

    console.error(error);

    return res.status(500).json({
      success: false,
      message: 'Gagal menghapus account',
    });
  }
};