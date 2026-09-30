/**
 * Helper tanggal berbasis zona waktu profil user. Kolom `@db.Date`
 * disimpan sebagai tengah malam UTC dari tanggal lokal user.
 */

export const DEFAULT_TIME_ZONE = 'Asia/Jakarta';

const formatDay = (instant: Date, timeZone: string) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant);

/** Tanggal lokal (YYYY-MM-DD) dari sebuah instan pada zona waktu tertentu. */
export const formatDateInTimeZone = (
  instant: Date,
  timeZone: string | null | undefined,
): string => {
  try {
    return formatDay(instant, timeZone || DEFAULT_TIME_ZONE);
  } catch {
    return formatDay(instant, DEFAULT_TIME_ZONE);
  }
};

/** "YYYY-MM-DD" → Date tengah malam UTC (format kolom DATE). */
export const parseDateOnly = (value: string): Date =>
  new Date(`${value}T00:00:00.000Z`);

/** Tanggal lokal sebuah instan sebagai nilai kolom DATE. */
export const toLocalDate = (
  instant: Date,
  timeZone: string | null | undefined,
): Date => parseDateOnly(formatDateInTimeZone(instant, timeZone));

/** "Hari ini" menurut zona waktu user sebagai nilai kolom DATE. */
export const todayInTimeZone = (
  timeZone: string | null | undefined,
  now: Date = new Date(),
): Date => toLocalDate(now, timeZone);
