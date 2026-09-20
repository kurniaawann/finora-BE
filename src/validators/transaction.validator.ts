import { z } from 'zod';

export const transactionTypeSchema = z.enum([
  'income',
  'expense',
  'refund',
  'adjustment',
]);

export const createTransactionSchema = z
  .object({
    account_id: z
      .string()
      .uuid('Account ID tidak valid'),

    category_id: z
      .string()
      .uuid('Category ID tidak valid')
      .nullable()
      .optional(),

    type: transactionTypeSchema,

    amount: z
      .number()
      .refine(
        (value) => value !== 0,
        'Nominal tidak boleh 0',
      ),

    transaction_date: z
      .string()
      .date('Tanggal transaksi tidak valid'),

    description: z
      .string()
      .trim()
      .max(
        500,
        'Deskripsi maksimal 500 karakter',
      )
      .nullable()
      .optional(),

    merchant: z
      .string()
      .trim()
      .max(
        255,
        'Nama merchant maksimal 255 karakter',
      )
      .nullable()
      .optional(),

    reference_number: z
      .string()
      .trim()
      .max(
        255,
        'Nomor referensi maksimal 255 karakter',
      )
      .nullable()
      .optional(),
  })
  .superRefine((data, ctx) => {
    if (
      data.type !== 'adjustment' &&
      data.amount <= 0
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['amount'],
        message:
          'Nominal harus lebih besar dari 0',
      });
    }
  });

export const updateTransactionSchema = z.object({
  account_id: z
    .string()
    .uuid('Account ID tidak valid')
    .optional(),

  category_id: z
    .string()
    .uuid('Category ID tidak valid')
    .nullable()
    .optional(),

  amount: z
    .number()
    .refine(
      (value) => value !== 0,
      'Nominal tidak boleh 0',
    )
    .optional(),

  transaction_date: z
    .string()
    .date('Tanggal transaksi tidak valid')
    .optional(),

  description: z
    .string()
    .trim()
    .max(
      500,
      'Deskripsi maksimal 500 karakter',
    )
    .nullable()
    .optional(),

  merchant: z
    .string()
    .trim()
    .max(
      255,
      'Nama merchant maksimal 255 karakter',
    )
    .nullable()
    .optional(),

  reference_number: z
    .string()
    .trim()
    .max(
      255,
      'Nomor referensi maksimal 255 karakter',
    )
    .nullable()
    .optional(),
});

export type CreateTransactionInput =
  z.infer<typeof createTransactionSchema>;

export type UpdateTransactionInput =
  z.infer<typeof updateTransactionSchema>;