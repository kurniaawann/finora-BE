import {
  countUnreadNotifications,
  deleteNotificationById,
  deleteReadNotificationsBefore,
  deleteReadNotificationsByUser,
  findNotificationById,
  findNotifications,
  type NotificationFilters,
  setAllNotificationsRead,
  setNotificationRead,
} from '../repositories/notification.repository.js';
import { notFound } from '../utils/app-error.js';
import type { PaginationParams } from '../utils/pagination.js';

/** Notifikasi yang sudah dibaca dibersihkan otomatis setelah umur ini. */
const READ_NOTIFICATION_RETENTION_DAYS = 90;
const DAY_MS = 24 * 60 * 60 * 1000;

const notificationNotFound = () =>
  notFound('NOTIFICATION_NOT_FOUND', 'Notifikasi tidak ditemukan');

export const listNotifications = (
  userId: string,
  { page, perPage }: PaginationParams,
  filters: NotificationFilters,
) =>
  findNotifications(userId, filters, {
    skip: (page - 1) * perPage,
    take: perPage,
  });

export const getUnreadCount = (userId: string): Promise<number> =>
  countUnreadNotifications(userId);

/** Idempoten: notifikasi yang sudah dibaca dikembalikan apa adanya. */
export const markNotificationRead = async (
  userId: string,
  notificationId: string,
) => {
  await setNotificationRead(notificationId, userId);

  const notification = await findNotificationById(notificationId, userId);

  if (!notification) {
    throw notificationNotFound();
  }

  return notification;
};

export const markAllNotificationsRead = async (userId: string) => {
  const result = await setAllNotificationsRead(userId);

  return { updated: result.count };
};

export const deleteNotification = async (
  userId: string,
  notificationId: string,
) => {
  const result = await deleteNotificationById(notificationId, userId);

  if (result.count === 0) {
    throw notificationNotFound();
  }
};

export const deleteReadNotifications = async (userId: string) => {
  const result = await deleteReadNotificationsByUser(userId);

  return { deleted: result.count };
};

/** Dipanggil scheduler; mengembalikan jumlah notifikasi yang dihapus. */
export const pruneOldNotifications = async (): Promise<number> => {
  const cutoff = new Date(
    Date.now() - READ_NOTIFICATION_RETENTION_DAYS * DAY_MS,
  );

  const result = await deleteReadNotificationsBefore(cutoff);

  return result.count;
};
