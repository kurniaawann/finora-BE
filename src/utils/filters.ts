import type { PaginationQuery } from './pagination.js';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const MAX_SEARCH_LENGTH = 100;

const readQuery = (
  query: PaginationQuery,
  key: string,
): string | undefined => {
  const raw = query[key];

  if (typeof raw !== 'string' || raw.trim().length === 0) {
    return undefined;
  }

  return raw.trim();
};

export const parseSearchQuery = (
  query: PaginationQuery,
): string | undefined => {
  const q = readQuery(query, 'search');

  return q ? q.slice(0, MAX_SEARCH_LENGTH) : undefined;
};

export const parseBooleanFilter = (
  query: PaginationQuery,
  key: string,
): boolean | undefined => {
  const raw = readQuery(query, key);

  if (raw === undefined) {
    return undefined;
  }

  if (raw === 'true' || raw === '1') {
    return true;
  }

  if (raw === 'false' || raw === '0') {
    return false;
  }

  throw new TypeError('INVALID_BOOLEAN_FILTER');
};

export const parseIdFilter = (
  query: PaginationQuery,
  key: string,
): string | undefined => {
  const raw = readQuery(query, key);

  if (raw === undefined) {
    return undefined;
  }

  if (!UUID_REGEX.test(raw)) {
    throw new TypeError('INVALID_ID_FILTER');
  }

  return raw;
};

export const parseEnumFilter = <T extends string>(
  query: PaginationQuery,
  key: string,
  allowed: readonly T[],
): T | undefined => {
  const raw = readQuery(query, key);

  if (raw === undefined) {
    return undefined;
  }

  if (!allowed.includes(raw as T)) {
    throw new TypeError('INVALID_ENUM_FILTER');
  }

  return raw as T;
};

export const parseDateFilter = (
  query: PaginationQuery,
  key: string,
): Date | undefined => {
  const raw = readQuery(query, key);

  if (raw === undefined) {
    return undefined;
  }

  if (!DATE_REGEX.test(raw)) {
    throw new TypeError('INVALID_DATE_FILTER');
  }

  const date = new Date(`${raw}T00:00:00.000Z`);

  if (Number.isNaN(date.getTime())) {
    throw new TypeError('INVALID_DATE_FILTER');
  }

  return date;
};

const endOfDay = (date: Date): Date => {
  const end = new Date(date);

  end.setUTCHours(23, 59, 59, 999);

  return end;
};

export interface DateRangeFilter {
  from: Date | undefined;
  to: Date | undefined;
}

export const parseDateRangeFilter = (
  query: PaginationQuery,
): DateRangeFilter => {
  const from = parseDateFilter(query, 'from_date');
  const to = parseDateFilter(query, 'to_date');

  if (from && to && from.getTime() > to.getTime()) {
    throw new TypeError('INVALID_DATE_RANGE');
  }

  return {
    from,
    to: to ? endOfDay(to) : undefined,
  };
};

export const parseAmountFilter = (
  query: PaginationQuery,
  key: string,
): number | undefined => {
  const raw = readQuery(query, key);

  if (raw === undefined) {
    return undefined;
  }

  const value = Number(raw);

  if (!Number.isFinite(value) || value < 0) {
    throw new TypeError('INVALID_AMOUNT_FILTER');
  }

  return value;
};