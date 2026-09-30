import { z } from 'zod';

// Batas aman kolom DECIMAL(18,2).
const MAX_AMOUNT = 1_000_000_000_000_000;

const amountSchema = z
  .number({ error: 'Nominal harus berupa angka' })
  .positive('Nominal transfer harus lebih besar dari 0')
  .lt(MAX_AMOUNT, 'Nominal terlalu besar');

const dateSchema = z.iso.date({
  error: 'Tanggal transfer harus berformat YYYY-MM-DD',
});

const noteSchema = z
  .string()
  .trim()
  .max(500, 'Catatan maksimal 500 karakter')
  .transform((value) => (value === '' ? null : value))
  .nullable()
  .optional();

export const createTransferSchema = z.object({
  from_account_id: z.uuid('Rekening asal tidak valid'),
  to_account_id: z.uuid('Rekening tujuan tidak valid'),
  amount: amountSchema,
  transfer_date: dateSchema,
  note: noteSchema,
});

export const updateTransferSchema = z.object({
  from_account_id: z.uuid('Rekening asal tidak valid').optional(),
  to_account_id: z.uuid('Rekening tujuan tidak valid').optional(),
  amount: amountSchema.optional(),
  transfer_date: dateSchema.optional(),
  note: noteSchema,
});

export type CreateTransferInput = z.infer<typeof createTransferSchema>;

export type UpdateTransferInput = z.infer<typeof updateTransferSchema>;
