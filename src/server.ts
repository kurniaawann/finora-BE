import app from './app.js';
import { prisma } from './config/database.js';
import { env } from './config/env.js';
import { isPushConfigured } from './config/firebase.js';
import { logger } from './config/logger.js';
import { isMailConfigured } from './config/mailer.js';
import { startSchedulers } from './jobs/scheduler.js';

const startServer = async () => {
  try {
    await prisma.$connect();

    const server = app.listen(env.port, () => {
      logger.info(`Finora API running on port ${env.port}`);
      logger.info(
        `Push notification: ${isPushConfigured() ? 'aktif' : 'nonaktif (FIREBASE_* kosong)'}`,
      );
      logger.info(
        `Email: ${isMailConfigured() ? 'aktif' : 'nonaktif (SMTP_HOST kosong)'}`,
      );
    });

    const stopSchedulers = startSchedulers();

    const shutdown = (signal: string) => {
      logger.info(`${signal} diterima, mematikan server...`);
      stopSchedulers();
      server.close(async () => {
        await prisma.$disconnect();
        process.exit(0);
      });
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  } catch (error) {
    logger.error('Failed to start server', error);
    await prisma.$disconnect();
    process.exit(1);
  }
};

startServer();
