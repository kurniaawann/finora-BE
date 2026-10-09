import type { Request, Response } from 'express';

import { toInvitationDTO } from '../dtos/invitation.dto.js';
import {
  acceptInvitation,
  cancelInvitation,
  createInvitation,
  getInvitation,
  listGroupInvitations,
  listMyInvitations,
  rejectInvitation,
} from '../services/invitation.service.js';
import {
  getAuthenticatedUserId,
  getAuthUser,
  getParam,
} from '../utils/auth.js';
import { parseEnumFilter } from '../utils/filters.js';
import { buildPaginationMeta, parsePagination } from '../utils/pagination.js';
import { success } from '../utils/response.js';
import {
  INVITATION_DIRECTIONS,
  INVITATION_STATUSES,
} from '../validators/invitation.validator.js';

export const createGroupInvitationController = async (
  req: Request,
  res: Response,
) => {
  const invitation = await createInvitation(
    getAuthenticatedUserId(req),
    getParam(req, 'groupId'),
    req.body,
  );

  return success(res, 201, 'Undangan berhasil dikirim', {
    data: toInvitationDTO(invitation, { includeEmail: true }),
  });
};

export const listGroupInvitationsController = async (
  req: Request,
  res: Response,
) => {
  const pagination = parsePagination(req.query);

  const result = await listGroupInvitations(
    getAuthenticatedUserId(req),
    getParam(req, 'groupId'),
    pagination,
    parseEnumFilter(req.query, 'status', INVITATION_STATUSES),
  );

  return success(res, 200, 'Daftar undangan grup berhasil diambil', {
    data: result.data.map((invitation) =>
      toInvitationDTO(invitation, { includeEmail: true }),
    ),
    pagination: buildPaginationMeta(pagination, result.total),
  });
};

export const listMyInvitationsController = async (
  req: Request,
  res: Response,
) => {
  const pagination = parsePagination(req.query);
  const direction =
    parseEnumFilter(req.query, 'direction', INVITATION_DIRECTIONS) ??
    'received';

  const result = await listMyInvitations(getAuthUser(req), pagination, {
    direction,
    status: parseEnumFilter(req.query, 'status', INVITATION_STATUSES),
  });

  return success(res, 200, 'Daftar undangan berhasil diambil', {
    data: result.data.map((invitation) =>
      toInvitationDTO(invitation, { includeEmail: direction === 'sent' }),
    ),
    pagination: buildPaginationMeta(pagination, result.total),
  });
};

export const getInvitationController = async (
  req: Request,
  res: Response,
) => {
  const { invitation, includeEmail } = await getInvitation(
    getAuthUser(req),
    getParam(req, 'id'),
  );

  return success(res, 200, 'Undangan berhasil diambil', {
    data: toInvitationDTO(invitation, { includeEmail }),
  });
};

export const acceptInvitationController = async (
  req: Request,
  res: Response,
) => {
  const invitation = await acceptInvitation(
    getAuthUser(req),
    getParam(req, 'id'),
  );

  return success(res, 200, 'Undangan diterima, kamu sudah bergabung ke grup', {
    data: toInvitationDTO(invitation, { includeEmail: false }),
  });
};

export const rejectInvitationController = async (
  req: Request,
  res: Response,
) => {
  const invitation = await rejectInvitation(
    getAuthUser(req),
    getParam(req, 'id'),
  );

  return success(res, 200, 'Undangan ditolak', {
    data: toInvitationDTO(invitation, { includeEmail: false }),
  });
};

export const cancelInvitationController = async (
  req: Request,
  res: Response,
) => {
  const invitation = await cancelInvitation(
    getAuthenticatedUserId(req),
    getParam(req, 'id'),
  );

  return success(res, 200, 'Undangan dibatalkan', {
    data: toInvitationDTO(invitation, { includeEmail: true }),
  });
};
