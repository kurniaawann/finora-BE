import { env } from '../config/env.js';
import { uploadUrlPrefix } from '../config/upload.js';
import type { Prisma } from '../generated/prisma/client.js';

/**
 * Serializer bersama agar semua endpoint mengirim format yang sama:
 * - uang      → string 2 desimal, mis. "150000.00" (hindari float di client)
 * - tanggal   → "YYYY-MM-DD" untuk kolom DATE
 * - waktu     → ISO 8601 UTC untuk kolom DATETIME
 * - foto      → URL absolut siap dipakai oleh komponen Image di mobile
 */

export type DecimalLike =
  | { toString(): string }
  | number
  | string;

export const toNumber = (
  value: DecimalLike | null | undefined,
): number => {
  if (value === null || value === undefined) {
    return 0;
  }

  return Number(value.toString());
};

export const toMoney = (
  value: DecimalLike | null | undefined,
): string => toNumber(value).toFixed(2);

export const toMoneyOrNull = (
  value: DecimalLike | null | undefined,
): string | null =>
  value === null || value === undefined ? null : toMoney(value);

export const toDateOnly = (value: Date | string): string =>
  new Date(value).toISOString().slice(0, 10);

export const toDateOnlyOrNull = (
  value: Date | string | null | undefined,
): string | null => (value ? toDateOnly(value) : null);

export const toIso = (value: Date | string): string =>
  new Date(value).toISOString();

export const toIsoOrNull = (
  value: Date | string | null | undefined,
): string | null => (value ? toIso(value) : null);

export const toPercentage = (part: number, whole: number): number => {
  if (whole <= 0) {
    return 0;
  }

  return Math.round((part / whole) * 10000) / 100;
};

/**
 * DB menyimpan path relatif (mis. "avatars/abc.webp"). Data lama yang
 * sudah berupa URL penuh dikembalikan apa adanya.
 */
export const toFileUrl = (
  value: string | null | undefined,
): string | null => {
  if (!value) {
    return null;
  }

  if (/^https?:\/\//i.test(value)) {
    return value;
  }

  const relative = value.replace(/^\/+/, '').replace(/^uploads\//, '');

  return `${env.appUrl}${uploadUrlPrefix}/${relative}`;
};

/* ------------------------------------------------------------------ */
/* Referensi user                                                      */
/* ------------------------------------------------------------------ */

export const userRefSelect = {
  id: true,
  name: true,
  profiles: {
    select: {
      username: true,
      avatar_url: true,
    },
  },
} satisfies Prisma.UserSelect;

export interface UserRefDTO {
  id: string;
  name: string;
  username: string | null;
  avatar_url: string | null;
}

export type UserRefSource = {
  id: string;
  name: string;
  profiles?: {
    username?: string | null;
    avatar_url?: string | null;
  } | null;
};

export const toUserRef = (user: UserRefSource): UserRefDTO => ({
  id: user.id,
  name: user.name,
  username: user.profiles?.username ?? null,
  avatar_url: toFileUrl(user.profiles?.avatar_url),
});

/* ------------------------------------------------------------------ */
/* Referensi rekening, metode bayar, kategori, grup                    */
/* ------------------------------------------------------------------ */

export const accountRefSelect = {
  id: true,
  name: true,
  type: true,
  currency: true,
} satisfies Prisma.accountsSelect;

export interface AccountRefDTO {
  id: string;
  name: string;
  type: string;
  currency: string;
}

export const toAccountRef = (account: AccountRefDTO): AccountRefDTO => ({
  id: account.id,
  name: account.name,
  type: account.type,
  currency: account.currency,
});

export const paymentMethodRefSelect = {
  id: true,
  name: true,
  type: true,
  account_id: true,
} satisfies Prisma.payment_methodsSelect;

export interface PaymentMethodRefDTO {
  id: string;
  name: string;
  type: string;
}

export const toPaymentMethodRef = (method: {
  id: string;
  name: string;
  type: string;
}): PaymentMethodRefDTO => ({
  id: method.id,
  name: method.name,
  type: method.type,
});

export const categoryRefSelect = {
  id: true,
  name: true,
  type: true,
  icon: true,
  color: true,
} satisfies Prisma.categoriesSelect;

export interface CategoryRefDTO {
  id: string;
  name: string;
  type: string;
  icon: string | null;
  color: string | null;
}

export const toCategoryRef = (category: {
  id: string;
  name: string;
  type: string;
  icon?: string | null;
  color?: string | null;
}): CategoryRefDTO => ({
  id: category.id,
  name: category.name,
  type: category.type,
  icon: category.icon ?? null,
  color: category.color ?? null,
});

export const groupRefSelect = {
  id: true,
  name: true,
  currency: true,
  avatar_url: true,
} satisfies Prisma.groupsSelect;

export interface GroupRefDTO {
  id: string;
  name: string;
  currency: string;
  avatar_url: string | null;
}

export const toGroupRef = (group: {
  id: string;
  name: string;
  currency: string;
  avatar_url?: string | null;
}): GroupRefDTO => ({
  id: group.id,
  name: group.name,
  currency: group.currency,
  avatar_url: toFileUrl(group.avatar_url),
});
