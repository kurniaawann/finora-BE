import { z } from 'zod';

export const paymentMethodTypeSchema = z.enum([
  'cash',
  'bank_transfer',
  'e_wallet',
  'card',
  'other',
]);

const nullableOptionalString = (
  schema: z.ZodString,
) => schema.trim().nullable().optional();

export const createPaymentMethodSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Nama metode pembayaran wajib diisi')
    .max(255, 'Nama metode pembayaran maksimal 255 karakter'),

  type: paymentMethodTypeSchema,

  provider: nullableOptionalString(
    z.string().max(255, 'Provider maksimal 255 karakter'),
  ),

  account_id: z
    .string()
    .uuid('ID akun tidak valid')
    .nullable()
    .optional(),

  is_default: z.boolean().optional().default(false),
});

export const updatePaymentMethodSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Nama metode pembayaran wajib diisi')
    .max(255, 'Nama metode pembayaran maksimal 255 karakter')
    .optional(),

  type: paymentMethodTypeSchema.optional(),

  provider: nullableOptionalString(
    z.string().max(255, 'Provider maksimal 255 karakter'),
  ),

  account_id: z
    .string()
    .uuid('ID akun tidak valid')
    .nullable()
    .optional(),

  is_default: z.boolean().optional(),

  is_active: z.boolean().optional(),
});

export type CreatePaymentMethodInput = z.infer<
  typeof createPaymentMethodSchema
>;

export type UpdatePaymentMethodInput = z.infer<
  typeof updatePaymentMethodSchema
>;