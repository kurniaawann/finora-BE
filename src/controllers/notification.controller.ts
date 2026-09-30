import type { Request, Response } from 'express';

import { toNotificationDTO } from '../dtos/notification.dto.js';
import type { notifications_type } from '../generated/prisma/enums.js';
import {
  deleteNotification,
  deleteReadNotifications,
  getUnreadCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../services/notification.service.js';
import { unprocessable } from '../utils/app-error.js';
import { getAuthenticatedUserId, getParam } from '../utils/auth.js';
import { parseBooleanFilter, parseEnumFilter } from '../utils/filters.js';
import { buildPaginationMeta, parsePagination } from '../utils/pagination.js';
import { success } from '../utils/response.js';

const NOTIFICATION_TYPES: readonly notifications_type[] = [
  'expense',
  'payment',
  'settlement',
  'invitation',
  'friend',
  'budget',
  'savings',
  'recurring',
  'system',
];

export const listNotificationsController = async (
  req: Request,
  res: Response,
) => {
  const pagination = parsePagination(req.query);

  const { data, total } = await listNotifications(
    getAuthenticatedUserId(req),
    pagination,
    {
      type: parseEnumFilter(req.query, 'type', NOTIFICATION_TYPES),
      isRead: parseBooleanFilter(req.query, 'is_read'),
    },
  );

  return success(res, 200, 'Notifikasi berhasil diambil', {
    data: data.map(toNotificationDTO),
    pagination: buildPaginationMeta(pagination, total),
  });
};

export const getUnreadCountController = async (
  req: Request,
  res: Response,
) => {
  const unreadCount = await getUnreadCount(getAuthenticatedUserId(req));

  return success(res, 200, 'Jumlah notifikasi belum dibaca berhasil diambil', {
    data: { unread_count: unreadCount },
  });
};

export const markNotificationReadController = async (
  req: Request,
  res: Response,
) => {
  const notification = await markNotificationRead(
    getAuthenticatedUserId(req),
    getParam(req, 'id'),
  );

  return success(res, 200, 'Notifikasi ditandai sudah dibaca', {
    data: toNotificationDTO(notification),
  });
};

export const markAllNotificationsReadController = async (
  req: Request,
  res: Response,
) => {
  const result = await markAllNotificationsRead(getAuthenticatedUserId(req));

  return success(res, 200, 'Semua notifikasi ditandai sudah dibaca', {
    data: result,
  });
};

export const deleteNotificationController = async (
  req: Request,
  res: Response,
) => {
  await deleteNotification(getAuthenticatedUserId(req), getParam(req, 'id'));

  return success(res, 200, 'Notifikasi berhasil dihapus');
};

/** Hapus massal hanya untuk yang sudah dibaca, wajib `?is_read=true`. */
export const deleteReadNotificationsController = async (
  req: Request,
  res: Response,
) => {
  if (parseBooleanFilter(req.query, 'is_read') !== true) {
    throw unprocessable(
      'READ_FILTER_REQUIRED',
      'Hapus massal hanya untuk notifikasi yang sudah dibaca, kirim ?is_read=true',
    );
  }

  const result = await deleteReadNotifications(getAuthenticatedUserId(req));

  return success(res, 200, 'Notifikasi yang sudah dibaca berhasil dihapus', {
    data: result,
  });
};
