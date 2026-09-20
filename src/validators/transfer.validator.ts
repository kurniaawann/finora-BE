import { z } from 'zod';

export const createTransferSchema = z.object({
  from_account_id: z
    .string()
    .uuid('From Account ID tidak valid'),

  to_account_id: z
    .string()
    .uuid('To Account ID tidak valid'),

  amount: z
    .number()
    .positive('Nominal transfer harus lebih besar dari 0'),

  transfer_date: z
    .string()
    .date('Tanggal transfer tidak valid'),

  note: z
    .string()
    .trim()
    .max(500, 'Catatan maksimal 500 karakter')
    .nullable()
    .optional(),
}).superRefine((data, ctx) => {
  if (data.from_account_id === data.to_account_id) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['to_account_id'],
      message: 'Akun asal dan akun tujuan tidak boleh sama',
    });
  }
});

export const updateTransferSchema = z
  .object({
    from_account_id: z
      .string()
      .uuid('From Account ID tidak valid')
      .optional(),

    to_account_id: z
      .string()
      .uuid('To Account ID tidak valid')
      .optional(),

    amount: z
      .number()
      .positive('Nominal transfer harus lebih besar dari 0')
      .optional(),

    transfer_date: z
      .string()
      .date('Tanggal transfer tidak valid')
      .optional(),

    note: z
      .string()
      .trim()
      .max(500, 'Catatan maksimal 500 karakter')
      .nullable()
      .optional(),
  })
  .superRefine((data, ctx) => {
    if (
      data.from_account_id &&
      data.to_account_id &&
      data.from_account_id === data.to_account_id
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['to_account_id'],
        message: 'Akun asal dan akun tujuan tidak boleh sama',
      });
    }
  });

export type CreateTransferInput = z.infer<typeof createTransferSchema>;

export type UpdateTransferInput = z.infer<typeof updateTransferSchema>;