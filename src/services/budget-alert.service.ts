import { logger } from '../config/logger.js';
import {
  BUDGET_EXCEEDED_PERCENTAGE,
  BUDGET_WARNING_PERCENTAGE,
  hasReachedPercentage,
} from '../dtos/budget.dto.js';
import { toDateOnly, toNumber, toPercentage } from '../dtos/common.dto.js';
import { Prisma } from '../generated/prisma/client.js';
import {
  findActiveBudgetsOn,
  findBudgetAlertNotifications,
  findUserProfileSettings,
  sumSpending,
  sumSpendingByCategory,
} from '../repositories/budget.repository.js';
import { formatMoney, notify } from './notifier.service.js';

// Urut dari yang tertinggi: yang dikirim hanya ambang tertinggi yang tercapai.
const THRESHOLDS = [BUDGET_EXCEEDED_PERCENTAGE, BUDGET_WARNING_PERCENTAGE];

interface AlertTarget {
  budgetId: string;
  budgetName: string;
  categoryId: string | null;
  categoryName: string | null;
  limit: Prisma.Decimal;
  spent: Prisma.Decimal;
}

const alertKey = (budgetId: string, categoryId: string | null) =>
  `${budgetId}:${categoryId ?? ''}`;

/** Ambang tertinggi yang sudah pernah dinotifikasikan per (anggaran, kategori). */
const loadSentThresholds = async (userId: string, budgetIds: string[]) => {
  const sent = new Map<string, number>();

  for (const { data } of await findBudgetAlertNotifications(
    userId,
    budgetIds,
  )) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      continue;
    }

    const budgetId = data.budget_id;
    const categoryId = data.category_id;
    const threshold = Number(data.threshold);

    if (typeof budgetId !== 'string' || !Number.isFinite(threshold)) {
      continue;
    }

    const key = alertKey(
      budgetId,
      typeof categoryId === 'string' ? categoryId : null,
    );

    sent.set(key, Math.max(sent.get(key) ?? 0, threshold));
  }

  return sent;
};

const buildMessage = (
  target: AlertTarget,
  threshold: number,
  currency: string,
) => {
  const subject = target.categoryName
    ? `Pengeluaran kategori '${target.categoryName}' di '${target.budgetName}'`
    : `Pengeluaran '${target.budgetName}'`;
  const spent = formatMoney(target.spent, currency);
  const limit = formatMoney(target.limit, currency);
  const percentage = Math.floor(
    toPercentage(toNumber(target.spent), toNumber(target.limit)),
  );

  return {
    title:
      threshold >= BUDGET_EXCEEDED_PERCENTAGE
        ? 'Anggaran terlampaui'
        : 'Anggaran hampir habis',
    message: `${subject} sudah ${percentage}% (${spent} dari ${limit})`,
  };
};

/**
 * Kirim notifikasi `budget` saat pemakaian anggaran aktif (total atau
 * per kategori) menembus 80% / 100%. Tiap ambang hanya dikirim sekali
 * per (anggaran, kategori); bila langsung melompat ke 100%, hanya
 * notifikasi 100% yang dikirim. Efek samping: tidak pernah melempar.
 */
export const checkBudgetAlerts = async (
  userId: string,
  transactionDate: Date,
): Promise<void> => {
  try {
    const date = new Date(`${toDateOnly(transactionDate)}T00:00:00.000Z`);
    const budgets = await findActiveBudgetsOn(userId, date);

    if (budgets.length === 0) {
      return;
    }

    const sent = await loadSentThresholds(
      userId,
      budgets.map((budget) => budget.id),
    );
    let currency: string | undefined;

    for (const budget of budgets) {
      const [spent, spentByCategory] = await Promise.all([
        sumSpending(userId, budget.start_date, budget.end_date),
        sumSpendingByCategory(
          userId,
          budget.budget_categories.map((item) => item.category_id),
          budget.start_date,
          budget.end_date,
        ),
      ]);

      const targets: AlertTarget[] = [
        {
          budgetId: budget.id,
          budgetName: budget.name,
          categoryId: null,
          categoryName: null,
          limit: budget.amount,
          spent,
        },
        ...budget.budget_categories.map((allocation) => ({
          budgetId: budget.id,
          budgetName: budget.name,
          categoryId: allocation.category_id,
          categoryName: allocation.categories.name,
          limit: allocation.amount,
          spent:
            spentByCategory.get(allocation.category_id) ??
            new Prisma.Decimal(0),
        })),
      ];

      for (const target of targets) {
        const threshold = THRESHOLDS.find((value) =>
          hasReachedPercentage(target.spent, target.limit, value),
        );

        if (
          threshold === undefined ||
          (sent.get(alertKey(target.budgetId, target.categoryId)) ?? 0) >=
            threshold
        ) {
          continue;
        }

        currency ??=
          (await findUserProfileSettings(userId))?.currency ?? 'IDR';

        await notify({
          userIds: userId,
          type: 'budget',
          ...buildMessage(target, threshold, currency),
          data: {
            budget_id: target.budgetId,
            category_id: target.categoryId,
            threshold,
          },
        });
      }
    }
  } catch (error) {
    logger.warn('Gagal memeriksa peringatan anggaran', error);
  }
};
