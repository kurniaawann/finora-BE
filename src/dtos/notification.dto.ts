import type { notifications_type } from '../generated/prisma/enums.js';
import { toIso } from './common.dto.js';

export interface NotificationDTO {
  id: string;
  type: notifications_type;
  title: string;
  message: string;
  /** ID terkait untuk deep link, mis. { goal_id, contribution_id }. */
  data: Record<string, unknown>;
  is_read: boolean;
  created_at: string;
}

const toDataObject = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

export const toNotificationDTO = (notification: {
  id: string;
  type: notifications_type;
  title: string;
  message: string;
  data: unknown;
  read_at: Date | null;
  created_at: Date;
}): NotificationDTO => ({
  id: notification.id,
  type: notification.type,
  title: notification.title,
  message: notification.message,
  data: toDataObject(notification.data),
  is_read: notification.read_at !== null,
  created_at: toIso(notification.created_at),
});
