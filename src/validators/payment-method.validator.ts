import { z } from 'zod';

export const PAYMENT_METHOD_TYPES = [
  'cash',
  'bank_transfer',
  'e_wallet',
  'card',
  'other',
] as const;

const nameSchema = z
  .string({ error: 'Nama metode pembayaran wajib diisi' })
  .trim()
  .min(1, 'Nama metode pembayaran wajib diisi')
  .max(255, 'Nama metode pembayaran maksimal 255 karakter');

const typeSchema = z.enum(PAYMENT_METHOD_TYPES, {
  error: 'Jenis metode pembayaran tidak valid',
});

const providerSchema = z
  .string()
  .trim()
  .max(255, 'Provider maksimal 255 karakter')
  .transform((value) => (value === '' ? null : value))
  .nullable()
  .optional();

const accountIdSchema = z
  .uuid('ID rekening tidak valid')
  .nullable()
  .optional();

export const createPaymentMethodSchema = z.object({
  name: nameSchema,
  type: typeSchema,
  provider: providerSchema,
  account_id: accountIdSchema,
  is_default: z.boolean({ error: 'is_default harus boolean' }).optional(),
});

export const updatePaymentMethodSchema = z.object({
  name: nameSchema.optional(),
  type: typeSchema.optional(),
  provider: providerSchema,
  account_id: accountIdSchema,
  is_default: z.boolean({ error: 'is_default harus boolean' }).optional(),
  is_active: z.boolean({ error: 'is_active harus boolean' }).optional(),
});

export type CreatePaymentMethodInput = z.infer<
  typeof createPaymentMethodSchema
>;

export type UpdatePaymentMethodInput = z.infer<
  typeof updatePaymentMethodSchema
>;
