import app from './app.js';
import { env } from './config/env.js';
import { prisma } from './config/database.js';
import { logger } from './config/logger.js';

const startServer = async () => {
  try {
    await prisma.$connect();
    app.listen(env.port, () => {
      logger.info(`Finora API running on http://localhost:${env.port}`);
    });
  } catch (error) {
    logger.error('Failed to start server', { error });
    await prisma.$disconnect();
    process.exit(1);
  }
};

startServer();