import type { Request, Response } from 'express';

import { toTransferDTO } from '../dtos/transfer.dto.js';
import {
  createTransfer,
  deleteTransfer,
  getTransfer,
  listTransfers,
  removeTransferProofPhoto,
  updateTransfer,
  updateTransferProofPhoto,
} from '../services/transfer.service.js';
import { getAuthenticatedUserId, getParam } from '../utils/auth.js';
import {
  parseAmountFilter,
  parseDateRangeFilter,
  parseIdFilter,
  parseSearchQuery,
} from '../utils/filters.js';
import { buildPaginationMeta, parsePagination } from '../utils/pagination.js';
import { success } from '../utils/response.js';

export const listTransfersController = async (req: Request, res: Response) => {
  const pagination = parsePagination(req.query);
  const dateRange = parseDateRangeFilter(req.query);

  const result = await listTransfers(getAuthenticatedUserId(req), pagination, {
    search: parseSearchQuery(req.query),
    fromAccountId: parseIdFilter(req.query, 'from_account_id'),
    toAccountId: parseIdFilter(req.query, 'to_account_id'),
    from: dateRange.from,
    to: dateRange.to,
    minAmount: parseAmountFilter(req.query, 'min_amount'),
    maxAmount: parseAmountFilter(req.query, 'max_amount'),
  });

  return success(res, 200, 'Daftar transfer berhasil diambil', {
    data: result.data.map(toTransferDTO),
    pagination: buildPaginationMeta(pagination, result.total),
  });
};

export const getTransferController = async (req: Request, res: Response) => {
  const transfer = await getTransfer(
    getAuthenticatedUserId(req),
    getParam(req, 'id'),
  );

  return success(res, 200, 'Transfer berhasil diambil', {
    data: toTransferDTO(transfer),
  });
};

export const createTransferController = async (
  req: Request,
  res: Response,
) => {
  const transfer = await createTransfer(getAuthenticatedUserId(req), req.body);

  return success(res, 201, 'Transfer berhasil dibuat', {
    data: toTransferDTO(transfer),
  });
};

export const updateTransferController = async (
  req: Request,
  res: Response,
) => {
  const transfer = await updateTransfer(
    getAuthenticatedUserId(req),
    getParam(req, 'id'),
    req.body,
  );

  return success(res, 200, 'Transfer berhasil diperbarui', {
    data: toTransferDTO(transfer),
  });
};

export const deleteTransferController = async (
  req: Request,
  res: Response,
) => {
  await deleteTransfer(getAuthenticatedUserId(req), getParam(req, 'id'));

  return success(res, 200, 'Transfer berhasil dihapus');
};

export const updateTransferProofController = async (
  req: Request,
  res: Response,
) => {
  const transfer = await updateTransferProofPhoto(
    getAuthenticatedUserId(req),
    getParam(req, 'id'),
    req.file,
  );

  return success(res, 200, 'Bukti transfer berhasil diunggah', {
    data: toTransferDTO(transfer),
  });
};

export const removeTransferProofController = async (
  req: Request,
  res: Response,
) => {
  const transfer = await removeTransferProofPhoto(
    getAuthenticatedUserId(req),
    getParam(req, 'id'),
  );

  return success(res, 200, 'Bukti transfer berhasil dihapus', {
    data: toTransferDTO(transfer),
  });
};
