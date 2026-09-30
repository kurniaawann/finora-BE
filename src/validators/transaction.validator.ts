import { z } from 'zod';

/** Tipe yang boleh dicatat manual; `transfer` hanya lewat /transfers. */
const MANUAL_TRANSACTION_TYPES = [
  'income',
  'expense',
  'refund',
  'adjustment',
] as const;

export const TRANSACTION_TYPES = [
  ...MANUAL_TRANSACTION_TYPES,
  'transfer',
] as const;

// Batas aman kolom DECIMAL(18,2).
const MAX_AMOUNT = 1_000_000_000_000_000;

const nullableText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label} maksimal ${max} karakter`)
    .transform((value) => (value === '' ? null : value))
    .nullable()
    .optional();

const typeSchema = z.enum(MANUAL_TRANSACTION_TYPES, {
  error: 'Jenis transaksi harus income, expense, refund, atau adjustment',
});

// Tanda nominal dicek terhadap jenis transaksi (adjustment boleh negatif).
const amountSchema = z
  .number({ error: 'Nominal harus berupa angka' })
  .refine((value) => value !== 0, 'Nominal tidak boleh 0')
  .refine(
    (value) => Math.abs(value) < MAX_AMOUNT,
    'Nominal terlalu besar',
  );

const fields = {
  account_id: z.uuid('Rekening tidak valid'),
  category_id: z.uuid('Kategori tidak valid').nullable().optional(),
  type: typeSchema,
  amount: amountSchema,
  transaction_date: z.iso.date({
    error: 'Tanggal transaksi harus berformat YYYY-MM-DD',
  }),
  description: nullableText(500, 'Deskripsi'),
  merchant: nullableText(255, 'Nama merchant'),
  reference_number: nullableText(255, 'Nomor referensi'),
};

export const createTransactionSchema = z
  .object(fields)
  .superRefine((data, ctx) => {
    if (data.type !== 'adjustment' && data.amount < 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['amount'],
        message: 'Nominal harus lebih besar dari 0',
      });
    }
  });

export const updateTransactionSchema = z.object({
  account_id: fields.account_id.optional(),
  category_id: fields.category_id,
  type: typeSchema.optional(),
  amount: amountSchema.optional(),
  transaction_date: fields.transaction_date.optional(),
  description: fields.description,
  merchant: fields.merchant,
  reference_number: fields.reference_number,
});

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;

export type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>;
