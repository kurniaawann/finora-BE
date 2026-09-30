import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getMessaging, type Messaging } from 'firebase-admin/messaging';

import { env } from './env.js';
import { logger } from './logger.js';

let messaging: Messaging | null | undefined;

export const isPushConfigured = (): boolean =>
  Boolean(
    env.firebase.projectId &&
      env.firebase.clientEmail &&
      env.firebase.privateKey,
  );

/**
 * Firebase Admin diinisialisasi sekali saat pertama dibutuhkan.
 * Mengembalikan null bila kredensial service account belum diisi,
 * sehingga push dinonaktifkan tanpa mengganggu fitur lain.
 */
export const getFirebaseMessaging = (): Messaging | null => {
  if (messaging !== undefined) {
    return messaging;
  }

  if (!isPushConfigured()) {
    messaging = null;
    return messaging;
  }

  try {
    const app: App =
      getApps()[0] ??
      initializeApp({
        credential: cert({
          projectId: env.firebase.projectId,
          clientEmail: env.firebase.clientEmail,
          privateKey: env.firebase.privateKey,
        }),
      });

    messaging = getMessaging(app);
  } catch (error) {
    logger.error('Inisialisasi Firebase gagal, push dinonaktifkan', error);
    messaging = null;
  }

  return messaging;
};
