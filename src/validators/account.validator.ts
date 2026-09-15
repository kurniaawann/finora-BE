import { z } from 'zod';

export const accountTypeSchema = z.enum([
  'bank',
  'cash',
  'e_wallet',
  'other',
]);

export const createAccountSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Nama rekening wajib diisi')
    .max(100, 'Nama rekening maksimal 100 karakter'),

  type: accountTypeSchema,

  initial_balance: z
    .number()
    .nonnegative('Saldo tidak boleh kurang dari 0'),

  currency: z
    .string()
    .trim()
    .length(3, 'Currency harus terdiri dari 3 karakter')
    .toUpperCase()
    .default('IDR'),
});

export const updateAccountSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Nama rekening wajib diisi')
    .max(100, 'Nama rekening maksimal 100 karakter')
    .optional(),

  type: accountTypeSchema.optional(),

  currency: z
    .string()
    .trim()
    .length(3, 'Currency harus terdiri dari 3 karakter')
    .toUpperCase()
    .optional(),

  is_active: z.boolean().optional(),
});

export type CreateAccountInput = z.infer<
  typeof createAccountSchema
>;

export type UpdateAccountInput = z.infer<
  typeof updateAccountSchema
>;