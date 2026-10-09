import type { Request, Response } from 'express';

import {
  toSavingsContributionDTO,
  toSavingsGoalDetailDTO,
  toSavingsGoalListDTO,
} from '../dtos/savings-goal.dto.js';
import type { savings_contributions_status } from '../generated/prisma/enums.js';
import type { SavingsGoalScope } from '../repositories/savings-goal.repository.js';
import {
  addContribution,
  cancelContribution,
  confirmContribution,
  createSavingsGoal,
  deleteContribution,
  deleteSavingsGoal,
  getContribution,
  getSavingsGoal,
  joinSavingsGoal,
  listContributions,
  listSavingsGoals,
  regenerateSavingsGoalShareToken,
  rejectContribution,
  removeContributionProof,
  updateContribution,
  updateSavingsGoal,
  uploadContributionProof,
} from '../services/savings-goal.service.js';
import { getAuthenticatedUserId, getParam } from '../utils/auth.js';
import {
  parseBooleanFilter,
  parseEnumFilter,
  parseIdFilter,
  parseSearchQuery,
} from '../utils/filters.js';
import { buildPaginationMeta, parsePagination } from '../utils/pagination.js';
import { success } from '../utils/response.js';

const GOAL_SCOPES: readonly SavingsGoalScope[] = ['all', 'mine', 'contributed'];

const CONTRIBUTION_STATUSES: readonly savings_contributions_status[] = [
  'pending',
  'submitted',
  'confirmed',
  'rejected',
  'cancelled',
];

/* ------------------------------------------------------------------ */
/* Target tabungan                                                     */
/* ------------------------------------------------------------------ */

export const createSavingsGoalController = async (
  req: Request,
  res: Response,
) => {
  const goal = await createSavingsGoal(getAuthenticatedUserId(req), req.body);

  return success(res, 201, 'Target tabungan berhasil dibuat', {
    data: toSavingsGoalDetailDTO(goal),
  });
};

export const listSavingsGoalsController = async (
  req: Request,
  res: Response,
) => {
  const pagination = parsePagination(req.query);

  const { data, total } = await listSavingsGoals(
    getAuthenticatedUserId(req),
    pagination,
    {
      scope: parseEnumFilter(req.query, 'scope', GOAL_SCOPES) ?? 'all',
      search: parseSearchQuery(req.query),
      isCompleted: parseBooleanFilter(req.query, 'is_completed'),
    },
  );

  return success(res, 200, 'Target tabungan berhasil diambil', {
    data: data.map(toSavingsGoalListDTO),
    pagination: buildPaginationMeta(pagination, total),
  });
};

export const getSavingsGoalController = async (
  req: Request,
  res: Response,
) => {
  const goal = await getSavingsGoal(
    getAuthenticatedUserId(req),
    getParam(req, 'id'),
  );

  return success(res, 200, 'Target tabungan berhasil diambil', {
    data: toSavingsGoalDetailDTO(goal),
  });
};

export const joinSavingsGoalController = async (
  req: Request,
  res: Response,
) => {
  const goal = await joinSavingsGoal(getAuthenticatedUserId(req), req.body);

  return success(res, 200, 'Target tabungan ditemukan', {
    data: toSavingsGoalDetailDTO(goal),
  });
};

export const updateSavingsGoalController = async (
  req: Request,
  res: Response,
) => {
  const goal = await updateSavingsGoal(
    getAuthenticatedUserId(req),
    getParam(req, 'id'),
    req.body,
  );

  return success(res, 200, 'Target tabungan berhasil diperbarui', {
    data: toSavingsGoalDetailDTO(goal),
  });
};

export const regenerateShareTokenController = async (
  req: Request,
  res: Response,
) => {
  const goal = await regenerateSavingsGoalShareToken(
    getAuthenticatedUserId(req),
    getParam(req, 'id'),
  );

  return success(res, 200, 'Token berbagi berhasil diperbarui', {
    data: toSavingsGoalDetailDTO(goal),
  });
};

export const deleteSavingsGoalController = async (
  req: Request,
  res: Response,
) => {
  await deleteSavingsGoal(getAuthenticatedUserId(req), getParam(req, 'id'));

  return success(res, 200, 'Target tabungan berhasil dihapus');
};

/* ------------------------------------------------------------------ */
/* Setoran                                                             */
/* ------------------------------------------------------------------ */

export const addContributionController = async (
  req: Request,
  res: Response,
) => {
  const userId = getAuthenticatedUserId(req);
  const contribution = await addContribution(
    userId,
    getParam(req, 'id'),
    req.body,
  );

  return success(res, 201, 'Setoran berhasil dicatat', {
    data: toSavingsContributionDTO(contribution, userId),
  });
};

export const listContributionsController = async (
  req: Request,
  res: Response,
) => {
  const userId = getAuthenticatedUserId(req);
  const pagination = parsePagination(req.query);

  const { data, total } = await listContributions(
    userId,
    getParam(req, 'id'),
    pagination,
    {
      status: parseEnumFilter(req.query, 'status', CONTRIBUTION_STATUSES),
      contributorId: parseIdFilter(req.query, 'contributor_id'),
    },
  );

  return success(res, 200, 'Setoran berhasil diambil', {
    data: data.map((item) => toSavingsContributionDTO(item, userId)),
    pagination: buildPaginationMeta(pagination, total),
  });
};

export const getContributionController = async (
  req: Request,
  res: Response,
) => {
  const userId = getAuthenticatedUserId(req);
  const contribution = await getContribution(
    userId,
    getParam(req, 'contributionId'),
  );

  return success(res, 200, 'Setoran berhasil diambil', {
    data: toSavingsContributionDTO(contribution, userId),
  });
};

export const updateContributionController = async (
  req: Request,
  res: Response,
) => {
  const userId = getAuthenticatedUserId(req);
  const contribution = await updateContribution(
    userId,
    getParam(req, 'contributionId'),
    req.body,
  );

  return success(res, 200, 'Setoran berhasil diperbarui', {
    data: toSavingsContributionDTO(contribution, userId),
  });
};

export const uploadContributionProofController = async (
  req: Request,
  res: Response,
) => {
  const userId = getAuthenticatedUserId(req);
  const contribution = await uploadContributionProof(
    userId,
    getParam(req, 'contributionId'),
    req.file,
  );

  return success(res, 200, 'Bukti setoran berhasil diunggah', {
    data: toSavingsContributionDTO(contribution, userId),
  });
};

export const removeContributionProofController = async (
  req: Request,
  res: Response,
) => {
  const userId = getAuthenticatedUserId(req);
  const contribution = await removeContributionProof(
    userId,
    getParam(req, 'contributionId'),
  );

  return success(res, 200, 'Bukti setoran berhasil dihapus', {
    data: toSavingsContributionDTO(contribution, userId),
  });
};

export const confirmContributionController = async (
  req: Request,
  res: Response,
) => {
  const userId = getAuthenticatedUserId(req);
  const contribution = await confirmContribution(
    userId,
    getParam(req, 'contributionId'),
  );

  return success(res, 200, 'Setoran berhasil dikonfirmasi', {
    data: toSavingsContributionDTO(contribution, userId),
  });
};

export const rejectContributionController = async (
  req: Request,
  res: Response,
) => {
  const userId = getAuthenticatedUserId(req);
  const contribution = await rejectContribution(
    userId,
    getParam(req, 'contributionId'),
  );

  return success(res, 200, 'Setoran berhasil ditolak', {
    data: toSavingsContributionDTO(contribution, userId),
  });
};

export const cancelContributionController = async (
  req: Request,
  res: Response,
) => {
  const userId = getAuthenticatedUserId(req);
  const contribution = await cancelContribution(
    userId,
    getParam(req, 'contributionId'),
  );

  return success(res, 200, 'Setoran berhasil dibatalkan', {
    data: toSavingsContributionDTO(contribution, userId),
  });
};

export const deleteContributionController = async (
  req: Request,
  res: Response,
) => {
  await deleteContribution(
    getAuthenticatedUserId(req),
    getParam(req, 'contributionId'),
  );

  return success(res, 200, 'Setoran berhasil dihapus');
};
