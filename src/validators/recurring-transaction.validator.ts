import { z } from 'zod';

export const RECURRING_TYPES = ['income', 'expense'] as const;

export const RECURRING_FREQUENCIES = [
  'daily',
  'weekly',
  'monthly',
  'yearly',
] as const;

// Batas aman kolom DECIMAL(18,2).
const MAX_AMOUNT = 1_000_000_000_000_000;

const nameSchema = z
  .string({ error: 'Nama wajib diisi' })
  .trim()
  .min(1, 'Nama wajib diisi')
  .max(255, 'Nama maksimal 255 karakter');

const typeSchema = z.enum(RECURRING_TYPES, {
  error: 'Jenis transaksi berulang harus income atau expense',
});

const frequencySchema = z.enum(RECURRING_FREQUENCIES, {
  error: 'Frekuensi harus daily, weekly, monthly, atau yearly',
});

const amountSchema = z
  .number({ error: 'Nominal harus berupa angka' })
  .positive('Nominal harus lebih besar dari 0')
  .lt(MAX_AMOUNT, 'Nominal terlalu besar');

const accountIdSchema = z.uuid({
  error: (issue) =>
    issue.input === undefined
      ? 'Rekening wajib dipilih'
      : 'ID rekening tidak valid',
});

const categoryIdSchema = z
  .uuid('ID kategori tidak valid')
  .nullable()
  .optional();

const dateSchema = (label: string) =>
  z.iso.date({ error: `${label} tidak valid, gunakan format YYYY-MM-DD` });

const descriptionSchema = z
  .string()
  .trim()
  .max(500, 'Deskripsi maksimal 500 karakter')
  .transform((value) => (value === '' ? null : value))
  .nullable()
  .optional();

const assertDateRange = (
  data: { start_date?: string; end_date?: string | null },
  ctx: z.RefinementCtx,
) => {
  if (data.start_date && data.end_date && data.end_date < data.start_date) {
    ctx.addIssue({
      code: 'custom',
      path: ['end_date'],
      message: 'Tanggal berakhir tidak boleh sebelum tanggal mulai',
    });
  }
};

export const createRecurringTransactionSchema = z
  .object({
    name: nameSchema,
    type: typeSchema,
    amount: amountSchema,
    frequency: frequencySchema,
    account_id: accountIdSchema,
    category_id: categoryIdSchema,
    start_date: dateSchema('Tanggal mulai'),
    end_date: dateSchema('Tanggal berakhir').nullable().optional(),
    is_active: z.boolean({ error: 'is_active harus boolean' }).optional(),
    description: descriptionSchema,
  })
  .superRefine(assertDateRange);

export const updateRecurringTransactionSchema = z
  .object({
    name: nameSchema.optional(),
    type: typeSchema.optional(),
    amount: amountSchema.optional(),
    frequency: frequencySchema.optional(),
    account_id: accountIdSchema.optional(),
    category_id: categoryIdSchema,
    start_date: dateSchema('Tanggal mulai').optional(),
    end_date: dateSchema('Tanggal berakhir').nullable().optional(),
    is_active: z.boolean({ error: 'is_active harus boolean' }).optional(),
    description: descriptionSchema,
  })
  .superRefine(assertDateRange);

export type CreateRecurringTransactionInput = z.infer<
  typeof createRecurringTransactionSchema
>;

export type UpdateRecurringTransactionInput = z.infer<
  typeof updateRecurringTransactionSchema
>;
