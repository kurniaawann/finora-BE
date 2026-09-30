import { z } from 'zod';

export const ACCOUNT_TYPES = [
  'cash',
  'bank',
  'e_wallet',
  'credit_card',
  'investment',
  'other',
] as const;

// Batas aman kolom DECIMAL(18,2).
const MAX_BALANCE = 1_000_000_000_000_000;

const nullableText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label} maksimal ${max} karakter`)
    .transform((value) => (value === '' ? null : value))
    .nullable()
    .optional();

const nameSchema = z
  .string({ error: 'Nama rekening wajib diisi' })
  .trim()
  .min(1, 'Nama rekening wajib diisi')
  .max(100, 'Nama rekening maksimal 100 karakter');

const typeSchema = z.enum(ACCOUNT_TYPES, {
  error: 'Jenis rekening tidak valid',
});

const balanceSchema = z
  .number({ error: 'Saldo awal harus berupa angka' })
  .gt(-MAX_BALANCE, 'Saldo awal terlalu kecil')
  .lt(MAX_BALANCE, 'Saldo awal terlalu besar');

const currencySchema = z
  .string({ error: 'Mata uang wajib diisi' })
  .trim()
  .regex(/^[a-zA-Z]{3}$/, 'Kode mata uang harus 3 huruf, contoh: IDR')
  .toUpperCase();

export const createAccountSchema = z
  .object({
    name: nameSchema,
    type: typeSchema,
    initial_balance: balanceSchema.default(0),
    currency: currencySchema.default('IDR'),
    institution_name: nullableText(100, 'Nama institusi'),
    account_number_masked: nullableText(30, 'Nomor rekening'),
    include_in_total_balance: z
      .boolean({ error: 'include_in_total_balance harus boolean' })
      .default(true),
  })
  .superRefine((data, ctx) => {
    // Saldo awal negatif hanya masuk akal untuk utang kartu kredit.
    if (data.type !== 'credit_card' && data.initial_balance < 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['initial_balance'],
        message: 'Saldo awal tidak boleh negatif kecuali kartu kredit',
      });
    }
  });

export const updateAccountSchema = z.object({
  name: nameSchema.optional(),
  type: typeSchema.optional(),
  initial_balance: balanceSchema.optional(),
  currency: currencySchema.optional(),
  institution_name: nullableText(100, 'Nama institusi'),
  account_number_masked: nullableText(30, 'Nomor rekening'),
  include_in_total_balance: z
    .boolean({ error: 'include_in_total_balance harus boolean' })
    .optional(),
  is_active: z.boolean({ error: 'is_active harus boolean' }).optional(),
});

export type CreateAccountInput = z.infer<typeof createAccountSchema>;

export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;
