import { Router } from 'express';
import accountRoutes from './account.routes.js';
import budgetRoutes from './budget.routes.js';
import categoryRoutes from './category.routes.js';
import friendRoutes from './friend.routes.js';
import paymentMethodRoutes from './payment-method.routes.js';
import { prisma } from '../config/database.js';
import authRoutes from './auth.routes.js';
import transactionRoutes from './transaction.routes.js';
import transferRoutes from './transfer.routes.js';
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

router.use('/auth', authRoutes);
router.use('/accounts', accountRoutes);
router.use('/transactions', transactionRoutes);
router.use('/transfers', transferRoutes);
router.use('/categories', categoryRoutes);
router.use('/budgets', budgetRoutes);
router.use('/friends', friendRoutes);
router.use('/payment-methods', paymentMethodRoutes);

export default router;