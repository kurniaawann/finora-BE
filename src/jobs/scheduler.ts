import { logger } from '../config/logger.js';
import { pruneExpiredRefreshTokens } from '../repositories/refresh-token.js';
import { pruneOldNotifications } from '../services/notification.service.js';
import { pruneStaleDeviceTokens } from '../services/push.service.js';
import { pruneVerificationCodes } from '../services/verification.service.js';
import { runDueRecurringTransactions } from '../services/recurring-transaction.service.js';

const HOUR_MS = 60 * 60 * 1000;

const runSafely = (name: string, job: () => Promise<unknown>) => {
  job().catch((error) => {
    logger.error(`Job "${name}" gagal`, error);
  });
};

/**
 * Job berkala sederhana di dalam proses API. Bila nanti server
 * dijalankan lebih dari satu instance, pindahkan ke worker terpisah
 * agar job tidak berjalan ganda.
 */
export const startSchedulers = () => {
  const jobs: [string, () => Promise<unknown>, number][] = [
    ['prune-refresh-tokens', pruneExpiredRefreshTokens, 24 * HOUR_MS],
    ['prune-read-notifications', pruneOldNotifications, 24 * HOUR_MS],
    ['prune-verification-codes', pruneVerificationCodes, 24 * HOUR_MS],
    ['prune-stale-device-tokens', pruneStaleDeviceTokens, 24 * HOUR_MS],
    ['run-recurring-transactions', () => runDueRecurringTransactions(), HOUR_MS],
  ];

  const timers = jobs.map(([name, job, interval]) => {
    runSafely(name, job);

    return setInterval(() => runSafely(name, job), interval);
  });

  return () => {
    for (const timer of timers) {
      clearInterval(timer);
    }
  };
};
