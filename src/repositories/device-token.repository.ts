import { prisma } from '../config/database.js';
import type { device_platform } from '../generated/prisma/enums.js';

/**
 * Daftarkan token perangkat. Token yang sebelumnya milik user lain
 * (perangkat ganti akun) dipindahkan ke user saat ini.
 */
export const upsertDeviceToken = (data: {
  userId: string;
  token: string;
  platform: device_platform;
}) =>
  prisma.device_tokens.upsert({
    where: { token: data.token },
    create: {
      user_id: data.userId,
      token: data.token,
      platform: data.platform,
    },
    update: {
      user_id: data.userId,
      platform: data.platform,
      last_used_at: new Date(),
    },
    select: { token: true, platform: true, last_used_at: true },
  });

export const deleteDeviceToken = (userId: string, token: string) =>
  prisma.device_tokens.deleteMany({
    where: { user_id: userId, token },
  });

export const deleteUserDeviceTokens = (userId: string) =>
  prisma.device_tokens.deleteMany({ where: { user_id: userId } });

export const deleteDeviceTokens = (tokens: string[]) =>
  prisma.device_tokens.deleteMany({ where: { token: { in: tokens } } });

export const findDeviceTokens = (userIds: string[]) =>
  prisma.device_tokens.findMany({
    where: { user_id: { in: userIds } },
    select: { token: true },
  });

/** Token yang tidak aktif lama kemungkinan sudah tidak valid di FCM. */
export const deleteStaleDeviceTokens = (before: Date) =>
  prisma.device_tokens.deleteMany({
    where: { last_used_at: { lt: before } },
  });
