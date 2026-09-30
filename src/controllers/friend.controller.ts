import type { Request, Response } from 'express';

import {
  toFriendDTO,
  toFriendRequestDTO,
  toUserSearchResultDTO,
} from '../dtos/friend.dto.js';
import {
  acceptFriendRequest,
  cancelFriendRequest,
  listFriendRequests,
  listFriends,
  rejectFriendRequest,
  searchUsers,
  sendFriendRequest,
  unfriend,
} from '../services/friend.service.js';
import { getAuthenticatedUserId, getParam } from '../utils/auth.js';
import { parseEnumFilter, parseSearchQuery } from '../utils/filters.js';
import { buildPaginationMeta, parsePagination } from '../utils/pagination.js';
import { success } from '../utils/response.js';
import {
  FRIEND_REQUEST_DIRECTIONS,
  FRIEND_REQUEST_STATUSES,
} from '../validators/friend.validator.js';

const readKeyword = (req: Request) =>
  typeof req.query.q === 'string'
    ? req.query.q.trim().slice(0, 100)
    : undefined;

export const searchUsersController = async (req: Request, res: Response) => {
  const pagination = parsePagination(req.query);
  const result = await searchUsers(
    getAuthenticatedUserId(req),
    readKeyword(req),
    pagination,
  );

  return success(res, 200, 'Hasil pencarian pengguna berhasil diambil', {
    data: result.data.map(toUserSearchResultDTO),
    pagination: buildPaginationMeta(pagination, result.total),
  });
};

export const listFriendRequestsController = async (
  req: Request,
  res: Response,
) => {
  const userId = getAuthenticatedUserId(req);
  const pagination = parsePagination(req.query);

  const result = await listFriendRequests(userId, pagination, {
    direction:
      parseEnumFilter(req.query, 'direction', FRIEND_REQUEST_DIRECTIONS) ??
      'received',
    status: parseEnumFilter(req.query, 'status', FRIEND_REQUEST_STATUSES),
  });

  return success(res, 200, 'Daftar permintaan pertemanan berhasil diambil', {
    data: result.data.map((request) => toFriendRequestDTO(request, userId)),
    pagination: buildPaginationMeta(pagination, result.total),
  });
};

export const sendFriendRequestController = async (
  req: Request,
  res: Response,
) => {
  const userId = getAuthenticatedUserId(req);
  const { request, autoAccepted } = await sendFriendRequest(userId, req.body);

  return autoAccepted
    ? success(res, 200, 'Kalian sekarang berteman', {
        data: toFriendRequestDTO(request, userId),
      })
    : success(res, 201, 'Permintaan pertemanan terkirim', {
        data: toFriendRequestDTO(request, userId),
      });
};

export const acceptFriendRequestController = async (
  req: Request,
  res: Response,
) => {
  const userId = getAuthenticatedUserId(req);
  const request = await acceptFriendRequest(userId, getParam(req, 'id'));

  return success(res, 200, 'Permintaan pertemanan diterima', {
    data: toFriendRequestDTO(request, userId),
  });
};

export const rejectFriendRequestController = async (
  req: Request,
  res: Response,
) => {
  const userId = getAuthenticatedUserId(req);
  const request = await rejectFriendRequest(userId, getParam(req, 'id'));

  return success(res, 200, 'Permintaan pertemanan ditolak', {
    data: toFriendRequestDTO(request, userId),
  });
};

export const cancelFriendRequestController = async (
  req: Request,
  res: Response,
) => {
  const userId = getAuthenticatedUserId(req);
  const request = await cancelFriendRequest(userId, getParam(req, 'id'));

  return success(res, 200, 'Permintaan pertemanan dibatalkan', {
    data: toFriendRequestDTO(request, userId),
  });
};

export const listFriendsController = async (req: Request, res: Response) => {
  const userId = getAuthenticatedUserId(req);
  const pagination = parsePagination(req.query);

  const result = await listFriends(
    userId,
    pagination,
    parseSearchQuery(req.query),
  );

  return success(res, 200, 'Daftar teman berhasil diambil', {
    data: result.data.map((friendship) => toFriendDTO(friendship, userId)),
    pagination: buildPaginationMeta(pagination, result.total),
  });
};

export const unfriendController = async (req: Request, res: Response) => {
  await unfriend(getAuthenticatedUserId(req), getParam(req, 'userId'));

  return success(res, 200, 'Pertemanan berhasil dihapus');
};
