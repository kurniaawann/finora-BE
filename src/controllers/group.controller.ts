import type { Request, Response } from 'express';

import {
  addMember,
  create,
  getAll,
  getById,
  joinByInviteCode,
  remove,
  removeMember,
  update,
  updateMember,
} from '../services/group.service.js';

import { getAuthenticatedUserId } from '../utils/auth.js';
import {
  buildPaginationMeta,
  parsePagination,
} from '../utils/pagination.js';
import {
  parseBooleanFilter,
  parseEnumFilter,
  parseSearchQuery,
} from '../utils/filters.js';
import {
  toGroupDetailDTO,
  toGroupSummaryDTO,
} from '../dtos/group.dto.js';
import { fail, success } from '../utils/response.js';
import { logger } from '../config/logger.js';

const GROUP_TYPES = [
  'personal',
  'club',
  'trip',
  'household',
  'project',
  'event',
  'other',
] as const;

const GROUP_ERRORS: Record<
  string,
  { status: number; message: string }
> = {
  GROUP_NOT_FOUND: {
    status: 404,
    message: 'Grup tidak ditemukan',
  },
  GROUP_ACCESS_DENIED: {
    status: 403,
    message: 'Anda tidak berhak mengakses grup ini',
  },
  INVITE_CODE_NOT_FOUND: {
    status: 404,
    message: 'Kode undangan tidak ditemukan',
  },
  ALREADY_MEMBER: {
    status: 409,
    message: 'Anda sudah menjadi anggota grup ini',
  },
  USER_NOT_FOUND: {
    status: 404,
    message: 'Pengguna tidak ditemukan',
  },
  GROUP_MEMBER_NOT_FOUND: {
    status: 404,
    message: 'Anggota grup tidak ditemukan',
  },
  OWNER_ROLE_LOCKED: {
    status: 409,
    message:
      'Peran owner tidak dapat diubah, dipindah, atau dihapus',
  },
};

const handleGroupError = (
  res: Response,
  error: unknown,
  context: string,
) => {
  if (
    error instanceof Error &&
    GROUP_ERRORS[error.message]
  ) {
    const { status, message } =
      GROUP_ERRORS[error.message];

    return fail(res, status, message);
  }

  logger.error(`${context}:`, error);

  return fail(
    res,
    500,
    'Terjadi kesalahan pada server',
  );
};

export const createGroupController = async (
  req: Request,
  res: Response,
) => {
  try {
    const userId = getAuthenticatedUserId(req);

    const group = await create(userId, req.body);

    if (!group) {
      return fail(
        res,
        500,
        'Terjadi kesalahan pada server',
      );
    }

    return success(
      res,
      201,
      'Grup berhasil dibuat',
      { data: toGroupSummaryDTO(group) },
    );
  } catch (error) {
    return handleGroupError(
      res,
      error,
      'Create group error',
    );
  }
};

export const getGroupsController = async (
  req: Request,
  res: Response,
) => {
  try {
    const userId = getAuthenticatedUserId(req);

    const { page, perPage } = parsePagination(
      req.query,
    );

    const result = await getAll(
      userId,
      page,
      perPage,
      {
        search: parseSearchQuery(req.query),
        type: parseEnumFilter(
          req.query,
          'type',
          GROUP_TYPES,
        ),
        isArchived: parseBooleanFilter(
          req.query,
          'is_archived',
        ),
      },
    );

    return success(
      res,
      200,
      'Data grup berhasil diambil',
      {
        data: result.data.map(toGroupSummaryDTO),
        pagination: buildPaginationMeta(
          { page, perPage },
          result.total,
        ),
      },
    );
  } catch (error) {
    if (error instanceof TypeError) {
      return fail(
        res,
        422,
        'Parameter filter tidak valid',
      );
    }

    return handleGroupError(
      res,
      error,
      'Get groups error',
    );
  }
};

export const getGroupController = async (
  req: Request,
  res: Response,
) => {
  try {
    const userId = getAuthenticatedUserId(req);
    const groupId = req.params.id as string;

    const group = await getById(userId, groupId);

    return success(
      res,
      200,
      'Data grup berhasil diambil',
      { data: toGroupDetailDTO(group) },
    );
  } catch (error) {
    return handleGroupError(
      res,
      error,
      'Get group error',
    );
  }
};

export const updateGroupController = async (
  req: Request,
  res: Response,
) => {
  try {
    const userId = getAuthenticatedUserId(req);
    const groupId = req.params.id as string;

    const group = await update(
      userId,
      groupId,
      req.body,
    );

    return success(
      res,
      200,
      'Grup berhasil diperbarui',
      { data: toGroupDetailDTO(group) },
    );
  } catch (error) {
    return handleGroupError(
      res,
      error,
      'Update group error',
    );
  }
};

export const deleteGroupController = async (
  req: Request,
  res: Response,
) => {
  try {
    const userId = getAuthenticatedUserId(req);
    const groupId = req.params.id as string;

    await remove(userId, groupId);

    return success(
      res,
      200,
      'Grup berhasil dihapus',
    );
  } catch (error) {
    return handleGroupError(
      res,
      error,
      'Delete group error',
    );
  }
};

export const joinGroupController = async (
  req: Request,
  res: Response,
) => {
  try {
    const userId = getAuthenticatedUserId(req);

    const member = await joinByInviteCode(
      userId,
      req.body,
    );

    return success(
      res,
      201,
      'Berhasil bergabung ke grup',
      { data: { id: member.id } },
    );
  } catch (error) {
    return handleGroupError(
      res,
      error,
      'Join group error',
    );
  }
};

export const addGroupMemberController = async (
  req: Request,
  res: Response,
) => {
  try {
    const userId = getAuthenticatedUserId(req);
    const groupId = req.params.id as string;

    const member = await addMember(
      userId,
      groupId,
      req.body,
    );

    return success(
      res,
      201,
      'Anggota berhasil ditambahkan ke grup',
      { data: { id: member.id } },
    );
  } catch (error) {
    return handleGroupError(
      res,
      error,
      'Add group member error',
    );
  }
};

export const updateGroupMemberController = async (
  req: Request,
  res: Response,
) => {
  try {
    const userId = getAuthenticatedUserId(req);
    const groupId = req.params.id as string;
    const targetUserId = req.params.userId as string;

    const member = await updateMember(
      userId,
      groupId,
      targetUserId,
      req.body,
    );

    return success(
      res,
      200,
      'Anggota grup berhasil diperbarui',
      { data: member },
    );
  } catch (error) {
    return handleGroupError(
      res,
      error,
      'Update group member error',
    );
  }
};

export const removeGroupMemberController = async (
  req: Request,
  res: Response,
) => {
  try {
    const userId = getAuthenticatedUserId(req);
    const groupId = req.params.id as string;
    const targetUserId = req.params.userId as string;

    await removeMember(userId, groupId, targetUserId);

    return success(
      res,
      200,
      targetUserId === userId
        ? 'Anda berhasil keluar dari grup'
        : 'Anggota berhasil dikeluarkan dari grup',
    );
  } catch (error) {
    return handleGroupError(
      res,
      error,
      'Remove group member error',
    );
  }
};