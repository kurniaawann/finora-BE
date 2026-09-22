import type { Request, Response } from 'express';

import {
  acceptFriendRequestService,
  cancelFriendRequestService,
  getFriendRequestsService,
  getFriendsService,
  rejectFriendRequestService,
  searchUsersService,
  sendFriendRequestService,
  unfriendService,
} from '../services/friend.service.js';

import type {
  RespondFriendRequestInput,
} from '../validators/friend.validator.js';

import {
  toFriendDTO,
  toFriendRequestDTO,
  toSearchUserDTO,
} from '../dtos/friend.dto.js';

import {
  buildPaginationMeta,
  parsePagination,
} from '../utils/pagination.js';
import {
  parseEnumFilter,
  parseSearchQuery,
} from '../utils/filters.js';
import { getAuthenticatedUserId } from '../utils/auth.js';
import { fail, success } from '../utils/response.js';
import { logger } from '../config/logger.js';

const FRIEND_REQUEST_STATUSES = [
  'pending',
  'accepted',
  'rejected',
  'cancelled',
] as const;

const REQUEST_DIRECTIONS = [
  'sent',
  'received',
] as const;

const FRIEND_ERRORS: Record<
  string,
  { status: number; message: string }
> = {
  USER_NOT_FOUND: {
    status: 404,
    message: 'Pengguna tidak ditemukan',
  },
  SELF_FRIEND_REQUEST: {
    status: 422,
    message: 'Tidak dapat berteman dengan diri sendiri',
  },
  ALREADY_FRIENDS: {
    status: 409,
    message: 'Kalian sudah berteman',
  },
  REQUEST_ALREADY_PENDING: {
    status: 409,
    message: 'Permintaan pertemanan sudah terkirim',
  },
  REQUEST_NOT_FOUND: {
    status: 404,
    message: 'Permintaan pertemanan tidak ditemukan',
  },
  REQUEST_NOT_AUTHORIZED: {
    status: 403,
    message: 'Tidak berhak mengubah permintaan ini',
  },
  REQUEST_ALREADY_RESPONDED: {
    status: 409,
    message: 'Permintaan pertemanan sudah ditanggapi',
  },
  FRIEND_NOT_FOUND: {
    status: 404,
    message: 'Teman tidak ditemukan',
  },
};

const handleFriendError = (
  res: Response,
  error: unknown,
  context: string,
) => {
  if (
    error instanceof Error &&
    FRIEND_ERRORS[error.message]
  ) {
    const { status, message } =
      FRIEND_ERRORS[error.message];

    return fail(res, status, message);
  }

  logger.error(`${context}:`, error);

  return fail(
    res,
    500,
    'Terjadi kesalahan pada server',
  );
};

export const searchUsersController = async (
  req: Request,
  res: Response,
) => {
  try {
    const userId = getAuthenticatedUserId(req);

    const { page, perPage } = parsePagination(
      req.query,
    );

    const result = await searchUsersService(
      userId,
      parseSearchQuery(req.query),
      page,
      perPage,
    );

    return success(
      res,
      200,
      'Data pengguna berhasil diambil',
      {
        data: result.data.map(toSearchUserDTO),
        pagination: buildPaginationMeta(
          { page, perPage },
          result.total,
        ),
      },
    );
  } catch (error) {
    return handleFriendError(
      res,
      error,
      'Search users error',
    );
  }
};

export const sendFriendRequestController = async (
  req: Request,
  res: Response,
) => {
  try {
    const userId = getAuthenticatedUserId(req);

    const request = await sendFriendRequestService(
      userId,
      req.body,
    );

    return success(
      res,
      201,
      'Permintaan pertemanan terkirim',
      { data: toFriendRequestDTO(request, userId) },
    );
  } catch (error) {
    return handleFriendError(
      res,
      error,
      'Send friend request error',
    );
  }
};

export const getFriendRequestsController = async (
  req: Request,
  res: Response,
) => {
  try {
    const userId = getAuthenticatedUserId(req);

    const { page, perPage } = parsePagination(
      req.query,
    );

    const direction =
      parseEnumFilter(
        req.query,
        'direction',
        REQUEST_DIRECTIONS,
      ) ?? 'received';

    const status = parseEnumFilter(
      req.query,
      'status',
      FRIEND_REQUEST_STATUSES,
    );

    const result = await getFriendRequestsService(
      userId,
      direction,
      page,
      perPage,
      { status },
    );

    return success(
      res,
      200,
      'Data permintaan pertemanan berhasil diambil',
      {
        data: result.data.map((request) =>
          toFriendRequestDTO(request, userId),
        ),
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

    return handleFriendError(
      res,
      error,
      'Get friend requests error',
    );
  }
};

export const respondFriendRequestController = async (
  req: Request,
  res: Response,
) => {
  try {
    const userId = getAuthenticatedUserId(req);
    const requestId = req.params.id as string;
    const { action } = req.body as RespondFriendRequestInput;

    const request =
      action === 'accept'
        ? await acceptFriendRequestService(
            userId,
            requestId,
          )
        : await rejectFriendRequestService(
            userId,
            requestId,
          );

    const message =
      action === 'accept'
        ? 'Permintaan pertemanan diterima'
        : 'Permintaan pertemanan ditolak';

    return success(
      res,
      200,
      message,
      { data: toFriendRequestDTO(request, userId) },
    );
  } catch (error) {
    return handleFriendError(
      res,
      error,
      'Respond friend request error',
    );
  }
};

export const cancelFriendRequestController = async (
  req: Request,
  res: Response,
) => {
  try {
    const userId = getAuthenticatedUserId(req);
    const requestId = req.params.id as string;

    const request = await cancelFriendRequestService(
      userId,
      requestId,
    );

    return success(
      res,
      200,
      'Permintaan pertemanan dibatalkan',
      { data: toFriendRequestDTO(request, userId) },
    );
  } catch (error) {
    return handleFriendError(
      res,
      error,
      'Cancel friend request error',
    );
  }
};

export const getFriendsController = async (
  req: Request,
  res: Response,
) => {
  try {
    const userId = getAuthenticatedUserId(req);

    const { page, perPage } = parsePagination(
      req.query,
    );

    const result = await getFriendsService(
      userId,
      parseSearchQuery(req.query),
      page,
      perPage,
    );

    return success(
      res,
      200,
      'Data teman berhasil diambil',
      {
        data: result.data.map((friendship) =>
          toFriendDTO(friendship, userId),
        ),
        pagination: buildPaginationMeta(
          { page, perPage },
          result.total,
        ),
      },
    );
  } catch (error) {
    return handleFriendError(
      res,
      error,
      'Get friends error',
    );
  }
};

export const unfriendController = async (
  req: Request,
  res: Response,
) => {
  try {
    const userId = getAuthenticatedUserId(req);
    const friendId = req.params.friendId as string;

    await unfriendService(userId, friendId);

    return success(
      res,
      200,
      'Pertemanan dihapus',
    );
  } catch (error) {
    return handleFriendError(
      res,
      error,
      'Unfriend error',
    );
  }
};