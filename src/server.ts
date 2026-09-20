import app from './app.js';
import { env } from './config/env.js';
import { prisma } from './config/database.js';
import { logger } from './config/logger.js';
import { pruneExpiredRefreshTokens } from './repositories/refresh-token.js';

const PRUNE_INTERVAL_MS = 24 * 60 * 60 * 1000;

const startServer = async () => {
  try {
    await prisma.$connect();
    app.listen(env.port, () => {
      logger.info(`Finora API running on http://localhost:${env.port}`);
    });

    // Pembersihan berkala refresh token yang revoked/expired.
    setInterval(() => {
      pruneExpiredRefreshTokens().catch((error) => {
        logger.error(
          'Periodic refresh token prune error:',
          error,
        );
      });
    }, PRUNE_INTERVAL_MS);
  } catch (error) {
    logger.error('Failed to start server', { error });
    await prisma.$disconnect();
    process.exit(1);
  }
};

startServer();