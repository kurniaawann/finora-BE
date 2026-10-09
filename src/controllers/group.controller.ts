import type { Request, Response } from 'express';

import {
  toGroupDetailDTO,
  toGroupJoinPreviewDTO,
  toGroupListItemDTO,
} from '../dtos/group.dto.js';
import {
  addMember,
  createGroup,
  deleteGroup,
  getBalances,
  getGroup,
  joinGroupByInviteCode,
  leaveGroup,
  listGroups,
  previewGroupByInviteCode,
  regenerateInviteCode,
  removeGroupAvatar,
  removeMember,
  transferOwnership,
  updateGroup,
  updateGroupAvatar,
  updateMember,
} from '../services/group.service.js';
import {
  getAuthenticatedUserId,
  getAuthUser,
  getParam,
} from '../utils/auth.js';
import {
  parseBooleanFilter,
  parseEnumFilter,
  parseSearchQuery,
} from '../utils/filters.js';
import { buildPaginationMeta, parsePagination } from '../utils/pagination.js';
import { success } from '../utils/response.js';
import { GROUP_TYPES } from '../validators/group.validator.js';

export const listGroupsController = async (req: Request, res: Response) => {
  const pagination = parsePagination(req.query);

  const result = await listGroups(getAuthenticatedUserId(req), pagination, {
    search: parseSearchQuery(req.query),
    type: parseEnumFilter(req.query, 'type', GROUP_TYPES),
    isArchived: parseBooleanFilter(req.query, 'is_archived') ?? false,
  });

  return success(res, 200, 'Daftar grup berhasil diambil', {
    data: result.data.map(toGroupListItemDTO),
    pagination: buildPaginationMeta(pagination, result.total),
  });
};

export const getGroupController = async (req: Request, res: Response) => {
  const userId = getAuthenticatedUserId(req);
  const group = await getGroup(userId, getParam(req, 'id'));

  return success(res, 200, 'Grup berhasil diambil', {
    data: toGroupDetailDTO(group, userId),
  });
};

export const createGroupController = async (req: Request, res: Response) => {
  const userId = getAuthenticatedUserId(req);
  const group = await createGroup(userId, req.body);

  return success(res, 201, 'Grup berhasil dibuat', {
    data: toGroupDetailDTO(group, userId),
  });
};

export const updateGroupController = async (req: Request, res: Response) => {
  const userId = getAuthenticatedUserId(req);
  const group = await updateGroup(userId, getParam(req, 'id'), req.body);

  return success(res, 200, 'Grup berhasil diperbarui', {
    data: toGroupDetailDTO(group, userId),
  });
};

export const deleteGroupController = async (req: Request, res: Response) => {
  await deleteGroup(getAuthenticatedUserId(req), getParam(req, 'id'));

  return success(res, 200, 'Grup berhasil dihapus');
};

export const updateGroupAvatarController = async (
  req: Request,
  res: Response,
) => {
  const userId = getAuthenticatedUserId(req);
  const group = await updateGroupAvatar(userId, getParam(req, 'id'), req.file);

  return success(res, 200, 'Foto grup berhasil diperbarui', {
    data: toGroupDetailDTO(group, userId),
  });
};

export const removeGroupAvatarController = async (
  req: Request,
  res: Response,
) => {
  const userId = getAuthenticatedUserId(req);
  const group = await removeGroupAvatar(userId, getParam(req, 'id'));

  return success(res, 200, 'Foto grup berhasil dihapus', {
    data: toGroupDetailDTO(group, userId),
  });
};

export const regenerateInviteCodeController = async (
  req: Request,
  res: Response,
) => {
  const userId = getAuthenticatedUserId(req);
  const group = await regenerateInviteCode(userId, getParam(req, 'id'));

  return success(res, 200, 'Kode undangan baru berhasil dibuat', {
    data: toGroupDetailDTO(group, userId),
  });
};

export const previewJoinGroupController = async (
  req: Request,
  res: Response,
) => {
  const preview = await previewGroupByInviteCode(
    getAuthenticatedUserId(req),
    getParam(req, 'inviteCode'),
  );

  return success(res, 200, 'Info grup berhasil diambil', {
    data: toGroupJoinPreviewDTO(preview),
  });
};

export const joinGroupController = async (req: Request, res: Response) => {
  const user = getAuthUser(req);
  const group = await joinGroupByInviteCode(user, req.body.invite_code);

  return success(res, 200, 'Berhasil bergabung ke grup', {
    data: toGroupDetailDTO(group, user.id),
  });
};

export const getGroupBalancesController = async (
  req: Request,
  res: Response,
) => {
  const balances = await getBalances(
    getAuthenticatedUserId(req),
    getParam(req, 'id'),
  );

  return success(res, 200, 'Saldo grup berhasil diambil', {
    data: balances,
  });
};

export const addGroupMemberController = async (
  req: Request,
  res: Response,
) => {
  const userId = getAuthenticatedUserId(req);
  const group = await addMember(userId, getParam(req, 'id'), req.body);

  return success(res, 201, 'Anggota berhasil ditambahkan ke grup', {
    data: toGroupDetailDTO(group, userId),
  });
};

export const updateGroupMemberController = async (
  req: Request,
  res: Response,
) => {
  const userId = getAuthenticatedUserId(req);
  const group = await updateMember(
    userId,
    getParam(req, 'id'),
    getParam(req, 'userId'),
    req.body,
  );

  return success(res, 200, 'Anggota grup berhasil diperbarui', {
    data: toGroupDetailDTO(group, userId),
  });
};

export const transferOwnershipController = async (
  req: Request,
  res: Response,
) => {
  const userId = getAuthenticatedUserId(req);
  const group = await transferOwnership(userId, getParam(req, 'id'), req.body);

  return success(res, 200, 'Kepemilikan grup berhasil dipindahkan', {
    data: toGroupDetailDTO(group, userId),
  });
};

export const removeGroupMemberController = async (
  req: Request,
  res: Response,
) => {
  const userId = getAuthenticatedUserId(req);
  const targetUserId = getParam(req, 'userId');

  await removeMember(userId, getParam(req, 'id'), targetUserId);

  return success(
    res,
    200,
    targetUserId === userId
      ? 'Kamu berhasil keluar dari grup'
      : 'Anggota berhasil dikeluarkan dari grup',
  );
};

export const leaveGroupController = async (req: Request, res: Response) => {
  await leaveGroup(getAuthenticatedUserId(req), getParam(req, 'id'));

  return success(res, 200, 'Kamu berhasil keluar dari grup');
};
