import type { Request, Response } from 'express';

import {
  create,
  getAll,
  getById,
  remove,
  update,
} from '../services/payment-method.service.js';

import { getAuthenticatedUserId } from '../utils/auth.js';
import {
  buildPaginationMeta,
  parsePagination,
} from '../utils/pagination.js';
import { toPaymentMethodDTO } from '../dtos/payment-method.dto.js';
import { fail, success } from '../utils/response.js';
import { logger } from '../config/logger.js';
import type { payment_methods_type } from '../generated/prisma/enums.js';

const parseTypeFilter = (
  req: Request,
): payment_methods_type | undefined => {
  const raw = req.query.type;

  if (typeof raw !== 'string' || raw.length === 0) {
    return undefined;
  }

  if (
    raw === 'cash' ||
    raw === 'bank_transfer' ||
    raw === 'e_wallet' ||
    raw === 'card' ||
    raw === 'other'
  ) {
    return raw;
  }

  throw new TypeError('INVALID_TYPE_FILTER');
};

export const createPaymentMethodController = async (
  req: Request,
  res: Response,
) => {
  try {
    const userId = getAuthenticatedUserId(req);

    const method = await create(userId, req.body);

    return success(
      res,
      201,
      'Metode pembayaran berhasil dibuat',
      { data: toPaymentMethodDTO(method) },
    );
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === 'ACCOUNT_NOT_FOUND'
    ) {
      return fail(
        res,
        404,
        'Akun tidak ditemukan',
      );
    }

    logger.error(error);

    return fail(
      res,
      500,
      'Gagal membuat metode pembayaran',
    );
  }
};

export const getPaymentMethodsController = async (
  req: Request,
  res: Response,
) => {
  try {
    const userId = getAuthenticatedUserId(req);

    const { page, perPage } = parsePagination(
      req.query,
    );

    const type = parseTypeFilter(req);

    const result = await getAll(
      userId,
      page,
      perPage,
      type,
    );

    return success(
      res,
      200,
      'Data metode pembayaran berhasil diambil',
      {
        data: result.data.map(toPaymentMethodDTO),
        pagination: buildPaginationMeta(
          { page, perPage },
          result.total,
        ),
      },
    );
  } catch (error) {
    if (
      error instanceof TypeError &&
      error.message === 'INVALID_TYPE_FILTER'
    ) {
      return fail(
        res,
        422,
        'Parameter filter tidak valid',
      );
    }

    logger.error(error);

    return fail(
      res,
      500,
      'Gagal mengambil metode pembayaran',
    );
  }
};

export const getPaymentMethodController = async (
  req: Request,
  res: Response,
) => {
  try {
    const userId = getAuthenticatedUserId(req);
    const methodId = req.params.id as string;

    const method = await getById(userId, methodId);

    return success(
      res,
      200,
      'Data metode pembayaran berhasil diambil',
      { data: toPaymentMethodDTO(method) },
    );
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === 'PAYMENT_METHOD_NOT_FOUND'
    ) {
      return fail(
        res,
        404,
        'Metode pembayaran tidak ditemukan',
      );
    }

    logger.error(error);

    return fail(
      res,
      500,
      'Gagal mengambil metode pembayaran',
    );
  }
};

export const updatePaymentMethodController = async (
  req: Request,
  res: Response,
) => {
  try {
    const userId = getAuthenticatedUserId(req);
    const methodId = req.params.id as string;

    await update(userId, methodId, req.body);

    return success(
      res,
      200,
      'Metode pembayaran berhasil diperbarui',
    );
  } catch (error) {
    if (error instanceof Error) {
      switch (error.message) {
        case 'PAYMENT_METHOD_NOT_FOUND':
          return fail(
            res,
            404,
            'Metode pembayaran tidak ditemukan',
          );

        case 'ACCOUNT_NOT_FOUND':
          return fail(
            res,
            404,
            'Akun tidak ditemukan',
          );
      }
    }

    logger.error(error);

    return fail(
      res,
      500,
      'Gagal memperbarui metode pembayaran',
    );
  }
};

export const deletePaymentMethodController = async (
  req: Request,
  res: Response,
) => {
  try {
    const userId = getAuthenticatedUserId(req);
    const methodId = req.params.id as string;

    await remove(userId, methodId);

    return success(
      res,
      200,
      'Metode pembayaran berhasil dinonaktifkan',
    );
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === 'PAYMENT_METHOD_NOT_FOUND'
    ) {
      return fail(
        res,
        404,
        'Metode pembayaran tidak ditemukan',
      );
    }

    logger.error(error);

    return fail(
      res,
      500,
      'Gagal menghapus metode pembayaran',
    );
  }
};