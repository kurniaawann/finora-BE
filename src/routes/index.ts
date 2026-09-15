import { Router } from 'express';
import { prisma } from '../config/database.js';

const router = Router();

router.get('/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;

    return res.status(200).json({
      success: true,
      message: 'Finora API is running',
      database: 'connected',
    });
  } catch {
    return res.status(500).json({
      success: false,
      message: 'Database connection failed',
    });
  }
});

export default router;