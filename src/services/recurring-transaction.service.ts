import { prisma } from '../config/database.js';
import { logger } from '../config/logger.js';
import { toDateOnly } from '../dtos/common.dto.js';
import { Prisma } from '../generated/prisma/client.js';
import type {
  recurring_transactions_frequency,
  recurring_transactions_type,
} from '../generated/prisma/enums.js';
import {
  advanceRecurringSchedule,
  createRecurringEntry,
  createRecurringTransaction,
  deleteRecurringTransaction,
  findDueRecurringTransactions,
  findRecurringTransactionById,
  findRecurringTransactions,
  findUserTimeZone,
  type RecurringFilters,
  updateRecurringTransaction,
} from '../repositories/recurring-transaction.repository.js';
import { conflict, notFound, unprocessable } from '../utils/app-error.js';
import type { PaginationParams } from '../utils/pagination.js';
import type {
  CreateRecurringTransactionInput,
  UpdateRecurringTransactionInput,
} from '../validators/recurring-transaction.validator.js';
import { checkBudgetAlerts } from './budget-alert.service.js';
import { formatMoney, notify } from './notifier.service.js';
import {
  requireOwnedAccount,
  requireUsableCategory,
} from './ownership.service.js';
import { parseDateOnly, todayInTimeZone } from '../utils/date.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_OCCURRENCES_PER_RUN = 31;
const DUE_BATCH_SIZE = 100;

/* ------------------------------------------------------------------ */
/* Tanggal & jadwal                                                    */
/* ------------------------------------------------------------------ */

const parseDate = parseDateOnly;

const daysInMonth = (year: number, month: number) =>
  new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

/**
 * Kejadian setelah `date`. Bulanan/tahunan memakai hari jangkar dari
 * start_date lalu dipotong ke panjang bulan, jadi 31 Jan → 28/29 Feb
 * → 31 Mar (tidak ikut bergeser ke tanggal 28 selamanya).
 */
const nextOccurrence = (
  date: Date,
  frequency: recurring_transactions_frequency,
  anchorDay: number,
): Date => {
  switch (frequency) {
    case 'daily':
      return new Date(date.getTime() + DAY_MS);
    case 'weekly':
      return new Date(date.getTime() + 7 * DAY_MS);
    case 'monthly':
    case 'yearly': {
      const monthIndex =
        date.getUTCMonth() + (frequency === 'monthly' ? 1 : 12);
      const year = date.getUTCFullYear() + Math.floor(monthIndex / 12);
      const month = monthIndex % 12;

      return new Date(
        Date.UTC(year, month, Math.min(anchorDay, daysInMonth(year, month))),
      );
    }
  }
};

const isAfterEnd = (date: Date, endDate: Date | null) =>
  endDate !== null && date.getTime() > endDate.getTime();

interface Schedule {
  frequency: recurring_transactions_frequency;
  start_date: Date;
  end_date: Date | null;
  next_run_date: Date;
}

/** Kejadian yang jatuh tempo s.d. `today` (maks `limit`) dan jadwal sesudahnya. */
const planDueOccurrences = (
  schedule: Schedule,
  today: Date,
  limit = MAX_OCCURRENCES_PER_RUN,
) => {
  const anchorDay = schedule.start_date.getUTCDate();
  const dates: Date[] = [];
  let cursor = schedule.next_run_date;

  while (
    dates.length < limit &&
    cursor.getTime() <= today.getTime() &&
    !isAfterEnd(cursor, schedule.end_date)
  ) {
    dates.push(cursor);
    cursor = nextOccurrence(cursor, schedule.frequency, anchorDay);
  }

  return {
    dates,
    nextRunDate: cursor,
    ended: isAfterEnd(cursor, schedule.end_date),
  };
};

/** Kejadian pertama yang jatuh pada/sesudah `today`. */
const firstOccurrenceFrom = (schedule: Schedule, today: Date) => {
  const anchorDay = schedule.start_date.getUTCDate();
  let cursor = schedule.next_run_date;

  while (cursor.getTime() < today.getTime()) {
    cursor = nextOccurrence(cursor, schedule.frequency, anchorDay);
  }

  return cursor;
};

/* ------------------------------------------------------------------ */
/* Eksekusi                                                            */
/* ------------------------------------------------------------------ */

interface RunnableRecurring {
  id: string;
  user_id: string;
  account_id: string;
  category_id: string | null;
  type: recurring_transactions_type;
  name: string;
  amount: Prisma.Decimal;
  description: string | null;
  next_run_date: Date;
}

/** Jadwal sudah dimajukan oleh proses lain (scheduler/instance lain). */
class ScheduleChangedError extends Error {}

const referenceNumberOf = (recurringId: string) =>
  `REC-${recurringId.replace(/-/g, '').slice(0, 12).toUpperCase()}`;

/** Catat transaksi untuk tiap tanggal dan majukan jadwal secara atomik. */
const recordOccurrences = (
  recurring: RunnableRecurring,
  dates: Date[],
  schedule: { next_run_date: Date; is_active: boolean },
) =>
  prisma.$transaction(async (tx) => {
    const advanced = await advanceRecurringSchedule(
      recurring.id,
      recurring.next_run_date,
      schedule,
      tx,
    );

    if (advanced.count === 0) {
      throw new ScheduleChangedError();
    }

    const entries = [];

    for (const date of dates) {
      entries.push(
        await createRecurringEntry(
          {
            user_id: recurring.user_id,
            account_id: recurring.account_id,
            category_id: recurring.category_id,
            type: recurring.type,
            status: 'completed',
            amount: recurring.amount,
            transaction_date: date,
            description: recurring.description ?? recurring.name,
            merchant: recurring.name,
            reference_number: referenceNumberOf(recurring.id),
          },
          tx,
        ),
      );
    }

    return entries;
  });

const alertBudgets = async (
  recurring: { user_id: string; type: recurring_transactions_type },
  dates: Date[],
) => {
  if (recurring.type !== 'expense') {
    return;
  }

  for (const date of dates) {
    await checkBudgetAlerts(recurring.user_id, date);
  }
};

const notifyRecorded = (
  recurring: RunnableRecurring,
  entries: { id: string; amount: Prisma.Decimal }[],
  currency: string,
) => {
  const label = recurring.type === 'income' ? 'Pemasukan' : 'Pengeluaran';
  const total = formatMoney(
    entries.reduce(
      (sum, entry) => sum.add(entry.amount),
      new Prisma.Decimal(0),
    ),
    currency,
  );

  return notify({
    userIds: recurring.user_id,
    type: 'recurring',
    title: 'Transaksi berulang dicatat',
    message:
      entries.length === 1
        ? `${label} berulang '${recurring.name}' sebesar ${total} sudah dicatat`
        : `${entries.length} ${label.toLowerCase()} berulang '${recurring.name}' (total ${total}) sudah dicatat`,
    data: {
      recurring_id: recurring.id,
      transaction_id: entries[entries.length - 1].id,
    },
  });
};

type DueRecurring = Awaited<
  ReturnType<typeof findDueRecurringTransactions>
>[number];

/** Mengembalikan jumlah transaksi yang dibuat. */
const processDueRecurring = async (recurring: DueRecurring, now: Date) => {
  const today = todayInTimeZone(recurring.users.profiles?.timezone, now);

  if (recurring.next_run_date.getTime() > today.getTime()) {
    return 0;
  }

  const plan = planDueOccurrences(recurring, today);

  if (plan.dates.length === 0) {
    // Jadwal sudah melewati end_date: cukup nonaktifkan.
    await advanceRecurringSchedule(
      recurring.id,
      recurring.next_run_date,
      { next_run_date: plan.nextRunDate, is_active: false },
      prisma,
    );

    return 0;
  }

  if (!recurring.account_id || !recurring.accounts?.is_active) {
    logger.warn(
      `Transaksi berulang ${recurring.id} dilewati: rekening tidak aktif`,
    );

    return 0;
  }

  const runnable = { ...recurring, account_id: recurring.account_id };
  let entries;

  try {
    entries = await recordOccurrences(runnable, plan.dates, {
      next_run_date: plan.nextRunDate,
      is_active: !plan.ended,
    });
  } catch (error) {
    if (error instanceof ScheduleChangedError) {
      return 0;
    }

    throw error;
  }

  await notifyRecorded(runnable, entries, recurring.accounts.currency);
  await alertBudgets(recurring, plan.dates);

  return entries.length;
};

/**
 * Dipanggil scheduler. Mencatat semua kejadian yang terlewat s.d. hari
 * ini (zona waktu profil user), maks 31 per item per putaran; sisanya
 * diproses di putaran berikutnya. Kegagalan satu item tidak
 * menghentikan item lain. `processed` = jumlah transaksi yang dibuat.
 */
export const runDueRecurringTransactions = async (
  now: Date = new Date(),
): Promise<{ processed: number }> => {
  // Zona waktu paling timur UTC+14, jadi "hari ini" user mana pun ≤ tanggal UTC + 1.
  const horizon = new Date(parseDate(toDateOnly(now)).getTime() + DAY_MS);
  let processed = 0;
  let afterId: string | undefined;

  for (;;) {
    const batch = await findDueRecurringTransactions(
      horizon,
      DUE_BATCH_SIZE,
      afterId,
    );

    for (const recurring of batch) {
      try {
        processed += await processDueRecurring(recurring, now);
      } catch (error) {
        logger.error(
          `Gagal memproses transaksi berulang ${recurring.id}`,
          error,
        );
      }
    }

    if (batch.length < DUE_BATCH_SIZE) {
      return { processed };
    }

    afterId = batch[batch.length - 1].id;
  }
};

/* ------------------------------------------------------------------ */
/* CRUD                                                                */
/* ------------------------------------------------------------------ */

const requireRecurring = async (userId: string, recurringId: string) => {
  const recurring = await findRecurringTransactionById(recurringId, userId);

  if (!recurring) {
    throw notFound(
      'RECURRING_NOT_FOUND',
      'Transaksi berulang tidak ditemukan',
    );
  }

  return recurring;
};

const assertCategoryType = async (
  userId: string,
  categoryId: string,
  type: recurring_transactions_type,
) => {
  const category = await requireUsableCategory(categoryId, userId);

  if (category.type !== type) {
    throw unprocessable(
      'INVALID_CATEGORY_TYPE',
      'Jenis kategori tidak sesuai dengan jenis transaksi',
    );
  }
};

export const listRecurringTransactions = (
  userId: string,
  pagination: PaginationParams,
  filters: RecurringFilters,
) => findRecurringTransactions(userId, pagination, filters);

export const getRecurringTransaction = (userId: string, recurringId: string) =>
  requireRecurring(userId, recurringId);

export const addRecurringTransaction = async (
  userId: string,
  input: CreateRecurringTransactionInput,
) => {
  await requireOwnedAccount(input.account_id, userId);

  if (input.category_id) {
    await assertCategoryType(userId, input.category_id, input.type);
  }

  const startDate = parseDate(input.start_date);

  return createRecurringTransaction({
    user_id: userId,
    account_id: input.account_id,
    category_id: input.category_id ?? null,
    type: input.type,
    name: input.name,
    amount: input.amount,
    frequency: input.frequency,
    start_date: startDate,
    end_date: input.end_date ? parseDate(input.end_date) : null,
    next_run_date: startDate,
    is_active: input.is_active ?? true,
    description: input.description ?? null,
  });
};

export const editRecurringTransaction = async (
  userId: string,
  recurringId: string,
  input: UpdateRecurringTransactionInput,
) => {
  const recurring = await requireRecurring(userId, recurringId);

  if (input.account_id) {
    await requireOwnedAccount(input.account_id, userId);
  }

  const type = input.type ?? recurring.type;
  const categoryId =
    input.category_id === undefined ? recurring.category_id : input.category_id;

  if (categoryId && (input.category_id || input.type)) {
    await assertCategoryType(userId, categoryId, type);
  }

  const startDate = input.start_date
    ? parseDate(input.start_date)
    : recurring.start_date;
  let endDate = recurring.end_date;

  if (input.end_date !== undefined) {
    endDate = input.end_date ? parseDate(input.end_date) : null;
  }

  if (endDate && endDate < startDate) {
    throw unprocessable(
      'INVALID_DATE_RANGE',
      'Tanggal berakhir tidak boleh sebelum tanggal mulai',
    );
  }

  // Belum pernah dijalankan: jadwal pertama ikut tanggal mulai yang baru.
  const neverRun =
    recurring.next_run_date.getTime() === recurring.start_date.getTime();
  let nextRunDate =
    input.start_date && neverRun ? startDate : recurring.next_run_date;

  // Diaktifkan kembali: kejadian selama nonaktif dilewati, tidak dicatat mundur.
  if (input.is_active === true && !recurring.is_active) {
    nextRunDate = firstOccurrenceFrom(
      {
        frequency: input.frequency ?? recurring.frequency,
        start_date: startDate,
        end_date: endDate,
        next_run_date: nextRunDate,
      },
      todayInTimeZone(await findUserTimeZone(userId)),
    );

    if (isAfterEnd(nextRunDate, endDate)) {
      throw unprocessable(
        'RECURRING_ENDED',
        'Jadwal sudah melewati tanggal berakhir, perpanjang tanggal berakhir terlebih dahulu',
      );
    }
  }

  return updateRecurringTransaction(recurringId, {
    name: input.name,
    type: input.type,
    amount: input.amount,
    frequency: input.frequency,
    account_id: input.account_id,
    category_id: input.category_id,
    start_date: input.start_date ? startDate : undefined,
    end_date: input.end_date === undefined ? undefined : endDate,
    next_run_date: nextRunDate,
    is_active: input.is_active,
    description: input.description,
  });
};

export const removeRecurringTransaction = async (
  userId: string,
  recurringId: string,
) => {
  const result = await deleteRecurringTransaction(recurringId, userId);

  if (result.count === 0) {
    throw notFound(
      'RECURRING_NOT_FOUND',
      'Transaksi berulang tidak ditemukan',
    );
  }
};

/**
 * Jalankan kejadian berikutnya sekarang walau belum jatuh tempo.
 * Bila dijalankan lebih awal, transaksi dicatat hari ini (uang keluar/
 * masuk sekarang), bukan di tanggal jadwal.
 */
export const runRecurringTransactionNow = async (
  userId: string,
  recurringId: string,
) => {
  const recurring = await requireRecurring(userId, recurringId);

  if (!recurring.is_active) {
    throw conflict(
      'RECURRING_INACTIVE',
      'Transaksi berulang tidak aktif, aktifkan terlebih dahulu',
    );
  }

  if (recurring.type !== 'income' && recurring.type !== 'expense') {
    throw unprocessable(
      'RECURRING_TYPE_UNSUPPORTED',
      'Hanya pemasukan atau pengeluaran berulang yang bisa dijalankan',
    );
  }

  if (!recurring.account_id) {
    throw unprocessable(
      'RECURRING_ACCOUNT_REQUIRED',
      'Pilih rekening untuk transaksi berulang ini terlebih dahulu',
    );
  }

  await requireOwnedAccount(recurring.account_id, userId);

  if (isAfterEnd(recurring.next_run_date, recurring.end_date)) {
    throw conflict('RECURRING_ENDED', 'Jadwal transaksi berulang sudah berakhir');
  }

  const nextRunDate = nextOccurrence(
    recurring.next_run_date,
    recurring.frequency,
    recurring.start_date.getUTCDate(),
  );
  const today = todayInTimeZone(await findUserTimeZone(userId));
  const transactionDate =
    recurring.next_run_date < today ? recurring.next_run_date : today;

  let transaction;

  try {
    [transaction] = await recordOccurrences(
      { ...recurring, account_id: recurring.account_id },
      [transactionDate],
      {
        next_run_date: nextRunDate,
        is_active: !isAfterEnd(nextRunDate, recurring.end_date),
      },
    );
  } catch (error) {
    if (error instanceof ScheduleChangedError) {
      throw conflict(
        'RECURRING_ALREADY_PROCESSED',
        'Transaksi berulang ini baru saja diproses, muat ulang data',
      );
    }

    throw error;
  }

  await alertBudgets(recurring, [transactionDate]);

  return {
    transaction,
    recurring: await requireRecurring(userId, recurringId),
  };
};
