import { getFirebaseMessaging } from '../config/firebase.js';
import { logger } from '../config/logger.js';
import {
  deleteDeviceTokens,
  deleteStaleDeviceTokens,
  findDeviceTokens,
} from '../repositories/device-token.repository.js';

const FCM_BATCH_SIZE = 500;
const STALE_TOKEN_DAYS = 60;

// Token yang sudah tidak berlaku di FCM dibuang agar tidak dikirimi lagi.
const INVALID_TOKEN_ERRORS = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
  'messaging/invalid-argument',
]);

export interface PushMessage {
  title: string;
  body: string;
  /** Semua nilai dikirim sebagai string (batasan FCM data payload). */
  data: Record<string, string>;
}

/**
 * Kirim push ke semua perangkat milik user. Tidak pernah throw;
 * push hanya pelengkap notifikasi in-app yang sudah tersimpan.
 */
export const sendPushToUsers = async (
  userIds: string[],
  message: PushMessage,
): Promise<void> => {
  const messaging = getFirebaseMessaging();

  if (!messaging || userIds.length === 0) {
    return;
  }

  try {
    const tokens = (await findDeviceTokens(userIds)).map((row) => row.token);
    const invalidTokens: string[] = [];
    const otherErrors = new Set<string>();

    for (let i = 0; i < tokens.length; i += FCM_BATCH_SIZE) {
      const batch = tokens.slice(i, i + FCM_BATCH_SIZE);

      const result = await messaging.sendEachForMulticast({
        tokens: batch,
        notification: { title: message.title, body: message.body },
        data: message.data,
        android: {
          priority: 'high',
          notification: { channelId: 'finora_default', sound: 'default' },
        },
        apns: { payload: { aps: { sound: 'default' } } },
      });

      result.responses.forEach((response, index) => {
        if (!response.error) {
          return;
        }

        if (INVALID_TOKEN_ERRORS.has(response.error.code)) {
          invalidTokens.push(batch[index]);
        } else {
          // Mis. kredensial service account salah atau kuota FCM habis.
          otherErrors.add(response.error.code);
        }
      });
    }

    if (invalidTokens.length > 0) {
      await deleteDeviceTokens(invalidTokens);
    }

    if (otherErrors.size > 0) {
      logger.warn(`Push FCM gagal: ${[...otherErrors].join(', ')}`);
    }
  } catch (error) {
    logger.warn('Gagal mengirim push notification', error);
  }
};

export const pruneStaleDeviceTokens = async () => {
  const before = new Date(Date.now() - STALE_TOKEN_DAYS * 24 * 60 * 60 * 1000);
  const result = await deleteStaleDeviceTokens(before);

  return result.count;
};
