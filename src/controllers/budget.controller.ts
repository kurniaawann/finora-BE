import type { Request, Response } from 'express';

import { toBudgetDTO, toBudgetDetailDTO } from '../dtos/budget.dto.js';
import {
  addBudget,
  editBudget,
  getBudget,
  listBudgets,
  removeBudget,
} from '../services/budget.service.js';
import { getAuthenticatedUserId, getParam } from '../utils/auth.js';
import {
  parseBooleanFilter,
  parseEnumFilter,
  parseSearchQuery,
} from '../utils/filters.js';
import { buildPaginationMeta, parsePagination } from '../utils/pagination.js';
import { success } from '../utils/response.js';
import { BUDGET_PERIODS } from '../validators/budget.validator.js';

export const listBudgetsController = async (req: Request, res: Response) => {
  const pagination = parsePagination(req.query);

  const result = await listBudgets(getAuthenticatedUserId(req), pagination, {
    search: parseSearchQuery(req.query),
    isActive: parseBooleanFilter(req.query, 'is_active'),
    period: parseEnumFilter(req.query, 'period', BUDGET_PERIODS),
  });

  return success(res, 200, 'Anggaran berhasil diambil', {
    data: result.data.map(({ budget, spent }) => toBudgetDTO(budget, spent)),
    pagination: buildPaginationMeta(pagination, result.total),
  });
};

export const getBudgetController = async (req: Request, res: Response) => {
  const { budget, spent, spentByCategory } = await getBudget(
    getAuthenticatedUserId(req),
    getParam(req, 'id'),
  );

  return success(res, 200, 'Anggaran berhasil diambil', {
    data: toBudgetDetailDTO(budget, spent, spentByCategory),
  });
};

export const createBudgetController = async (req: Request, res: Response) => {
  const { budget, spent, spentByCategory } = await addBudget(
    getAuthenticatedUserId(req),
    req.body,
  );

  return success(res, 201, 'Anggaran berhasil dibuat', {
    data: toBudgetDetailDTO(budget, spent, spentByCategory),
  });
};

export const updateBudgetController = async (req: Request, res: Response) => {
  const { budget, spent, spentByCategory } = await editBudget(
    getAuthenticatedUserId(req),
    getParam(req, 'id'),
    req.body,
  );

  return success(res, 200, 'Anggaran berhasil diperbarui', {
    data: toBudgetDetailDTO(budget, spent, spentByCategory),
  });
};

export const deleteBudgetController = async (req: Request, res: Response) => {
  await removeBudget(getAuthenticatedUserId(req), getParam(req, 'id'));

  return success(res, 200, 'Anggaran berhasil dihapus');
};
