import { prisma } from '../config/database.js';
import type { Prisma } from '../generated/prisma/client.js';
import type { notifications_type } from '../generated/prisma/enums.js';

export interface NotificationFilters {
  type?: notifications_type;
  isRead?: boolean;
}

export const findNotifications = async (
  userId: string,
  filters: NotificationFilters,
  page: { skip: number; take: number },
) => {
  const where: Prisma.notificationsWhereInput = {
    user_id: userId,
    ...(filters.type && { type: filters.type }),
    ...(filters.isRead !== undefined && {
      read_at: filters.isRead ? { not: null } : null,
    }),
  };

  const [data, total] = await prisma.$transaction([
    prisma.notifications.findMany({
      where,
      orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
      skip: page.skip,
      take: page.take,
    }),
    prisma.notifications.count({ where }),
  ]);

  return { data, total };
};

export const countUnreadNotifications = (userId: string) =>
  prisma.notifications.count({
    where: { user_id: userId, read_at: null },
  });

export const findNotificationById = (notificationId: string, userId: string) =>
  prisma.notifications.findFirst({
    where: { id: notificationId, user_id: userId },
  });

export const setNotificationRead = (notificationId: string, userId: string) =>
  prisma.notifications.updateMany({
    where: { id: notificationId, user_id: userId, read_at: null },
    data: { read_at: new Date() },
  });

export const setAllNotificationsRead = (userId: string) =>
  prisma.notifications.updateMany({
    where: { user_id: userId, read_at: null },
    data: { read_at: new Date() },
  });

export const deleteNotificationById = (
  notificationId: string,
  userId: string,
) =>
  prisma.notifications.deleteMany({
    where: { id: notificationId, user_id: userId },
  });

export const deleteReadNotificationsByUser = (userId: string) =>
  prisma.notifications.deleteMany({
    where: { user_id: userId, read_at: { not: null } },
  });

export const deleteReadNotificationsBefore = (cutoff: Date) =>
  prisma.notifications.deleteMany({
    where: { read_at: { not: null }, created_at: { lt: cutoff } },
  });
