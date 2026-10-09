import { Router } from 'express';

import { prisma } from '../config/database.js';
import { fail, success } from '../utils/response.js';
import accountRoutes from './account.routes.js';
import authRoutes from './auth.routes.js';
import budgetRoutes from './budget.routes.js';
import categoryRoutes from './category.routes.js';
import deviceRoutes from './device.routes.js';
import eventRoutes from './event.routes.js';
import expenseRoutes from './expense.routes.js';
import friendRoutes from './friend.routes.js';
import groupRoutes from './group.routes.js';
import homeRoutes from './home.routes.js';
import invitationRoutes from './invitation.routes.js';
import notificationRoutes from './notification.routes.js';
import paymentMethodRoutes from './payment-method.routes.js';
import profileRoutes from './profile.routes.js';
import recurringRoutes from './recurring-transaction.routes.js';
import savingsGoalRoutes from './savings-goal.routes.js';
import settlementRoutes from './settlement.routes.js';
import transactionRoutes from './transaction.routes.js';
import transferRoutes from './transfer.routes.js';

const router = Router();

router.get('/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;

    return success(res, 200, 'Finora API is running');
  } catch {
    return fail(res, 503, 'Database tidak dapat dihubungi', {
      code: 'SERVICE_UNAVAILABLE',
    });
  }
});

router.use('/auth', authRoutes);
router.use('/home', homeRoutes);
router.use('/profile', profileRoutes);

// Keuangan pribadi
router.use('/accounts', accountRoutes);
router.use('/transactions', transactionRoutes);
router.use('/transfers', transferRoutes);
router.use('/categories', categoryRoutes);
router.use('/payment-methods', paymentMethodRoutes);
router.use('/budgets', budgetRoutes);
router.use('/recurring-transactions', recurringRoutes);
router.use('/savings-goals', savingsGoalRoutes);

// Sosial & patungan
router.use('/friends', friendRoutes);
router.use('/groups', groupRoutes);
router.use('/invitations', invitationRoutes);
router.use('/events', eventRoutes);
router.use('/expenses', expenseRoutes);
router.use('/settlements', settlementRoutes);

router.use('/notifications', notificationRoutes);
router.use('/devices', deviceRoutes);

export default router;
