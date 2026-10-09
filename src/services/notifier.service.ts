import { prisma } from '../config/database.js';
import { logger } from '../config/logger.js';
import type { Prisma } from '../generated/prisma/client.js';
import type { notifications_type } from '../generated/prisma/enums.js';
import { sendPushToUsers } from './push.service.js';

export interface NotifyInput {
  /** Penerima; duplikat dan `excludeUserId` otomatis dibuang. */
  userIds: string | string[];
  type: notifications_type;
  title: string;
  message: string;
  /**
   * ID terkait untuk deep link di aplikasi, selalu snake_case,
   * mis. { expense_id, group_id }.
   */
  data?: Record<string, string | number | null>;
  /** Biasanya user yang melakukan aksi, agar tidak menotifikasi diri sendiri. */
  excludeUserId?: string;
}

/**
 * Notifikasi adalah efek samping: kegagalannya dicatat tetapi tidak
 * menggagalkan aksi utama user. Setelah tersimpan (in-app), push
 * dikirim di latar belakang tanpa menunda respons.
 */
export const notify = async (input: NotifyInput): Promise<void> => {
  const recipients = [
    ...new Set(
      Array.isArray(input.userIds) ? input.userIds : [input.userIds],
    ),
  ].filter((userId) => userId && userId !== input.excludeUserId);

  if (recipients.length === 0) {
    return;
  }

  try {
    await prisma.notifications.createMany({
      data: recipients.map((userId) => ({
        user_id: userId,
        type: input.type,
        title: input.title,
        message: input.message,
        data: (input.data ?? {}) as Prisma.InputJsonObject,
      })),
    });
  } catch (error) {
    logger.warn('Gagal membuat notifikasi', error);
    return;
  }

  // `type` + ID di `data` dipakai aplikasi untuk membuka layar terkait.
  const pushData: Record<string, string> = { type: input.type };

  for (const [key, value] of Object.entries(input.data ?? {})) {
    if (value !== null && value !== undefined) {
      pushData[key] = String(value);
    }
  }

  void sendPushToUsers(recipients, {
    title: input.title,
    body: input.message,
    data: pushData,
  });
};

/** Format nominal untuk teks notifikasi, mis. "Rp 150.000". */
export const formatMoney = (
  value: { toString(): string } | number | string,
  currency = 'IDR',
): string => {
  try {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(Number(value.toString()));
  } catch {
    return `${currency} ${value.toString()}`;
  }
};
