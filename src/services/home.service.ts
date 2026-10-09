import { toMoney } from '../dtos/common.dto.js';
import { toTransactionDTO } from '../dtos/transaction.dto.js';
import { getAccountBalances } from '../repositories/account.repository.js';
import {
  countPendingActions,
  findActiveAccounts,
  findHomeProfile,
} from '../repositories/home.repository.js';
import { Prisma } from '../generated/prisma/client.js';
import { unprocessable } from '../utils/app-error.js';
import { formatDateInTimeZone, parseDateOnly } from '../utils/date.js';
import { getUserDebtSummary } from './balance.service.js';
import { getActiveBudgetsSummary } from './budget.service.js';
import { getUnreadCount } from './notification.service.js';
import { getSavingsOverview } from './savings-goal.service.js';
import {
  getTransactionSummary,
  listTransactions,
} from './transaction.service.js';

const RECENT_TRANSACTION_LIMIT = 5;
const TOP_CATEGORY_LIMIT = 3;
const BUDGET_LIMIT = 3;

const resolveMonth = (month: string | undefined, today: string) => {
  const value = month ?? today.slice(0, 7);

  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) {
    throw unprocessable(
      'INVALID_FILTER',
      'Parameter filter "month" tidak valid, gunakan format YYYY-MM',
    );
  }

  const [year, monthIndex] = value.split('-').map(Number);

  return {
    month: value,
    start: new Date(Date.UTC(year, monthIndex - 1, 1)),
    end: new Date(Date.UTC(year, monthIndex, 0)),
  };
};

/**
 * Ringkasan satu layar untuk halaman Home aplikasi mobile.
 * `month` (YYYY-MM) hanya memengaruhi arus kas; saldo, anggaran,
 * tabungan, dan utang selalu kondisi terkini.
 */
export const getHome = async (userId: string, month?: string) => {
  const profile = await findHomeProfile(userId);
  const currency = profile.profiles?.currency ?? 'IDR';
  const today = formatDateInTimeZone(new Date(), profile.profiles?.timezone);
  const period = resolveMonth(month, today);

  const accounts = await findActiveAccounts(userId);

  const [
    balances,
    cashFlow,
    recent,
    budgets,
    savings,
    debts,
    pendingActions,
    unreadCount,
  ] = await Promise.all([
    getAccountBalances(
      userId,
      accounts.map((account) => account.id),
    ),
    getTransactionSummary(userId, period.start, period.end),
    listTransactions(
      userId,
      { page: 1, perPage: RECENT_TRANSACTION_LIMIT },
      {},
    ),
    getActiveBudgetsSummary(userId, parseDateOnly(today)),
    getSavingsOverview(userId),
    getUserDebtSummary(userId),
    countPendingActions(
      userId,
      profile.email_verified_at ? profile.email : null,
    ),
    getUnreadCount(userId),
  ]);

  let total = new Prisma.Decimal(0);

  const accountItems = accounts.map((account) => {
    const currentBalance = new Prisma.Decimal(account.initial_balance).add(
      balances.get(account.id) ?? 0,
    );

    // Total saldo hanya menjumlahkan rekening bermata uang profil.
    if (account.include_in_total_balance && account.currency === currency) {
      total = total.add(currentBalance);
    }

    return {
      id: account.id,
      name: account.name,
      type: account.type,
      currency: account.currency,
      current_balance: toMoney(currentBalance),
      include_in_total_balance: account.include_in_total_balance,
    };
  });

  return {
    currency,
    period: {
      month: period.month,
      start_date: period.start.toISOString().slice(0, 10),
      end_date: period.end.toISOString().slice(0, 10),
    },
    balance: {
      total: toMoney(total),
      account_count: accounts.length,
    },
    accounts: accountItems,
    cash_flow: {
      income: cashFlow.income,
      expense: cashFlow.expense,
      saved: cashFlow.saved,
      net: cashFlow.net,
    },
    top_expense_categories: cashFlow.by_category.slice(0, TOP_CATEGORY_LIMIT),
    recent_transactions: recent.data.map(toTransactionDTO),
    budgets: budgets.slice(0, BUDGET_LIMIT),
    savings,
    debts,
    pending_actions: pendingActions,
    unread_notification_count: unreadCount,
  };
};
