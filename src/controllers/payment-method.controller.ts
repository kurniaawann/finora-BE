import type { Request, Response } from 'express';

import { toPaymentMethodDTO } from '../dtos/payment-method.dto.js';
import {
  addPaymentMethod,
  editPaymentMethod,
  getPaymentMethod,
  listPaymentMethods,
  removePaymentMethod,
} from '../services/payment-method.service.js';
import { getAuthenticatedUserId, getParam } from '../utils/auth.js';
import {
  parseBooleanFilter,
  parseEnumFilter,
  parseSearchQuery,
} from '../utils/filters.js';
import { buildPaginationMeta, parsePagination } from '../utils/pagination.js';
import { success } from '../utils/response.js';
import { PAYMENT_METHOD_TYPES } from '../validators/payment-method.validator.js';

export const listPaymentMethodsController = async (
  req: Request,
  res: Response,
) => {
  const pagination = parsePagination(req.query);

  const result = await listPaymentMethods(
    getAuthenticatedUserId(req),
    pagination,
    {
      search: parseSearchQuery(req.query),
      type: parseEnumFilter(req.query, 'type', PAYMENT_METHOD_TYPES),
      isActive: parseBooleanFilter(req.query, 'is_active'),
    },
  );

  return success(res, 200, 'Metode pembayaran berhasil diambil', {
    data: result.data.map(toPaymentMethodDTO),
    pagination: buildPaginationMeta(pagination, result.total),
  });
};

export const getPaymentMethodController = async (
  req: Request,
  res: Response,
) => {
  const method = await getPaymentMethod(
    getAuthenticatedUserId(req),
    getParam(req, 'id'),
  );

  return success(res, 200, 'Metode pembayaran berhasil diambil', {
    data: toPaymentMethodDTO(method),
  });
};

export const createPaymentMethodController = async (
  req: Request,
  res: Response,
) => {
  const method = await addPaymentMethod(getAuthenticatedUserId(req), req.body);

  return success(res, 201, 'Metode pembayaran berhasil dibuat', {
    data: toPaymentMethodDTO(method),
  });
};

export const updatePaymentMethodController = async (
  req: Request,
  res: Response,
) => {
  const method = await editPaymentMethod(
    getAuthenticatedUserId(req),
    getParam(req, 'id'),
    req.body,
  );

  return success(res, 200, 'Metode pembayaran berhasil diperbarui', {
    data: toPaymentMethodDTO(method),
  });
};

export const deletePaymentMethodController = async (
  req: Request,
  res: Response,
) => {
  const { archived } = await removePaymentMethod(
    getAuthenticatedUserId(req),
    getParam(req, 'id'),
  );

  return success(
    res,
    200,
    archived
      ? 'Metode pembayaran sudah dipakai di riwayat pembayaran, jadi dinonaktifkan'
      : 'Metode pembayaran berhasil dihapus',
  );
};
