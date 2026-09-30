import type { Request, Response } from 'express';

import { toSettlementDTO } from '../dtos/settlement.dto.js';
import {
  cancelSettlement,
  confirmSettlement,
  createSettlement,
  deleteSettlement,
  getSettlement,
  listGroupSettlements,
  rejectSettlement,
  removeSettlementProof,
  updateSettlement,
  updateSettlementProof,
} from '../services/settlement.service.js';
import { getAuthenticatedUserId, getParam } from '../utils/auth.js';
import {
  parseAmountFilter,
  parseBooleanFilter,
  parseDateRangeFilter,
  parseEnumFilter,
  parseIdFilter,
} from '../utils/filters.js';
import { buildPaginationMeta, parsePagination } from '../utils/pagination.js';
import { success } from '../utils/response.js';
import { SETTLEMENT_STATUSES } from '../validators/settlement.validator.js';

export const createSettlementController = async (
  req: Request,
  res: Response,
) => {
  const userId = getAuthenticatedUserId(req);
  const settlement = await createSettlement(
    userId,
    getParam(req, 'groupId'),
    req.body,
  );

  return success(res, 201, 'Pelunasan berhasil dikirim', {
    data: toSettlementDTO(settlement, userId),
  });
};

export const listGroupSettlementsController = async (
  req: Request,
  res: Response,
) => {
  const userId = getAuthenticatedUserId(req);
  const pagination = parsePagination(req.query);
  const { from, to } = parseDateRangeFilter(req.query);

  const { items, total } = await listGroupSettlements(
    userId,
    getParam(req, 'groupId'),
    pagination,
    {
      status: parseEnumFilter(req.query, 'status', SETTLEMENT_STATUSES),
      fromUserId: parseIdFilter(req.query, 'from_user_id'),
      toUserId: parseIdFilter(req.query, 'to_user_id'),
      involvingMe: parseBooleanFilter(req.query, 'involving_me'),
      from,
      to,
      minAmount: parseAmountFilter(req.query, 'min_amount'),
      maxAmount: parseAmountFilter(req.query, 'max_amount'),
    },
  );

  return success(res, 200, 'Daftar pelunasan berhasil diambil', {
    data: items.map((settlement) => toSettlementDTO(settlement, userId)),
    pagination: buildPaginationMeta(pagination, total),
  });
};

export const getSettlementController = async (req: Request, res: Response) => {
  const userId = getAuthenticatedUserId(req);
  const settlement = await getSettlement(userId, getParam(req, 'id'));

  return success(res, 200, 'Pelunasan berhasil diambil', {
    data: toSettlementDTO(settlement, userId),
  });
};

export const updateSettlementController = async (
  req: Request,
  res: Response,
) => {
  const userId = getAuthenticatedUserId(req);
  const settlement = await updateSettlement(
    userId,
    getParam(req, 'id'),
    req.body,
  );

  return success(res, 200, 'Pelunasan berhasil diperbarui', {
    data: toSettlementDTO(settlement, userId),
  });
};

export const deleteSettlementController = async (
  req: Request,
  res: Response,
) => {
  await deleteSettlement(getAuthenticatedUserId(req), getParam(req, 'id'));

  return success(res, 200, 'Pelunasan berhasil dihapus');
};

export const confirmSettlementController = async (
  req: Request,
  res: Response,
) => {
  const userId = getAuthenticatedUserId(req);
  const settlement = await confirmSettlement(
    userId,
    getParam(req, 'id'),
    req.body,
  );

  return success(res, 200, 'Pelunasan berhasil dikonfirmasi', {
    data: toSettlementDTO(settlement, userId),
  });
};

export const rejectSettlementController = async (
  req: Request,
  res: Response,
) => {
  const userId = getAuthenticatedUserId(req);
  const settlement = await rejectSettlement(userId, getParam(req, 'id'));

  return success(res, 200, 'Pelunasan berhasil ditolak', {
    data: toSettlementDTO(settlement, userId),
  });
};

export const cancelSettlementController = async (
  req: Request,
  res: Response,
) => {
  const userId = getAuthenticatedUserId(req);
  const settlement = await cancelSettlement(userId, getParam(req, 'id'));

  return success(res, 200, 'Pelunasan berhasil dibatalkan', {
    data: toSettlementDTO(settlement, userId),
  });
};

export const updateSettlementProofController = async (
  req: Request,
  res: Response,
) => {
  const userId = getAuthenticatedUserId(req);
  const settlement = await updateSettlementProof(
    userId,
    getParam(req, 'id'),
    req.file,
  );

  return success(res, 200, 'Bukti pelunasan berhasil diunggah', {
    data: toSettlementDTO(settlement, userId),
  });
};

export const removeSettlementProofController = async (
  req: Request,
  res: Response,
) => {
  const userId = getAuthenticatedUserId(req);
  const settlement = await removeSettlementProof(userId, getParam(req, 'id'));

  return success(res, 200, 'Bukti pelunasan berhasil dihapus', {
    data: toSettlementDTO(settlement, userId),
  });
};
