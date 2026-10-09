import type { Request, Response } from 'express';

import { toAccountDTO } from '../dtos/account.dto.js';
import {
  createAccount,
  deleteAccount,
  getAccount,
  listAccounts,
  updateAccount,
} from '../services/account.service.js';
import { getAuthenticatedUserId, getParam } from '../utils/auth.js';
import {
  parseBooleanFilter,
  parseEnumFilter,
  parseSearchQuery,
} from '../utils/filters.js';
import { buildPaginationMeta, parsePagination } from '../utils/pagination.js';
import { success } from '../utils/response.js';
import { ACCOUNT_TYPES } from '../validators/account.validator.js';

export const listAccountsController = async (req: Request, res: Response) => {
  const pagination = parsePagination(req.query);

  const result = await listAccounts(getAuthenticatedUserId(req), pagination, {
    search: parseSearchQuery(req.query),
    type: parseEnumFilter(req.query, 'type', ACCOUNT_TYPES),
    isActive: parseBooleanFilter(req.query, 'is_active'),
  });

  return success(res, 200, 'Daftar rekening berhasil diambil', {
    data: result.data.map(toAccountDTO),
    pagination: buildPaginationMeta(pagination, result.total),
  });
};

export const getAccountController = async (req: Request, res: Response) => {
  const account = await getAccount(
    getAuthenticatedUserId(req),
    getParam(req, 'id'),
  );

  return success(res, 200, 'Rekening berhasil diambil', {
    data: toAccountDTO(account),
  });
};

export const createAccountController = async (
  req: Request,
  res: Response,
) => {
  const account = await createAccount(getAuthenticatedUserId(req), req.body);

  return success(res, 201, 'Rekening berhasil dibuat', {
    data: toAccountDTO(account),
  });
};

export const updateAccountController = async (
  req: Request,
  res: Response,
) => {
  const account = await updateAccount(
    getAuthenticatedUserId(req),
    getParam(req, 'id'),
    req.body,
  );

  return success(res, 200, 'Rekening berhasil diperbarui', {
    data: toAccountDTO(account),
  });
};

export const deleteAccountController = async (
  req: Request,
  res: Response,
) => {
  const { archived } = await deleteAccount(
    getAuthenticatedUserId(req),
    getParam(req, 'id'),
  );

  return success(
    res,
    200,
    archived
      ? 'Rekening sudah memiliki riwayat, jadi dinonaktifkan dan tidak dihitung di total saldo'
      : 'Rekening berhasil dihapus',
  );
};
