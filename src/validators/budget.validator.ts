import { z } from 'zod';

export const BUDGET_PERIODS = ['current', 'upcoming', 'past'] as const;

// Batas aman kolom DECIMAL(18,2).
const MAX_AMOUNT = 1_000_000_000_000_000;

const amountSchema = (label: string) =>
  z
    .number({ error: `${label} harus berupa angka` })
    .positive(`${label} harus lebih besar dari 0`)
    .lt(MAX_AMOUNT, `${label} terlalu besar`);

const dateSchema = (label: string) =>
  z.iso.date({ error: `${label} tidak valid, gunakan format YYYY-MM-DD` });

const nameSchema = z
  .string({ error: 'Nama anggaran wajib diisi' })
  .trim()
  .min(1, 'Nama anggaran wajib diisi')
  .max(255, 'Nama anggaran maksimal 255 karakter');

const categoriesSchema = z
  .array(
    z.object({
      category_id: z.uuid('ID kategori tidak valid'),
      amount: amountSchema('Nominal alokasi'),
    }),
    { error: 'Daftar kategori tidak valid' },
  )
  .max(50, 'Maksimal 50 kategori per anggaran')
  .refine(
    (items) =>
      new Set(items.map((item) => item.category_id)).size === items.length,
    'Kategori tidak boleh duplikat',
  );

const assertDateRange = (
  data: { start_date?: string; end_date?: string },
  ctx: z.RefinementCtx,
) => {
  if (data.start_date && data.end_date && data.end_date < data.start_date) {
    ctx.addIssue({
      code: 'custom',
      path: ['end_date'],
      message: 'Tanggal selesai tidak boleh sebelum tanggal mulai',
    });
  }
};

export const createBudgetSchema = z
  .object({
    name: nameSchema,
    amount: amountSchema('Total anggaran'),
    start_date: dateSchema('Tanggal mulai'),
    end_date: dateSchema('Tanggal selesai'),
    is_active: z.boolean({ error: 'is_active harus boolean' }).optional(),
    categories: categoriesSchema.optional(),
  })
  .superRefine(assertDateRange);

export const updateBudgetSchema = z
  .object({
    name: nameSchema.optional(),
    amount: amountSchema('Total anggaran').optional(),
    start_date: dateSchema('Tanggal mulai').optional(),
    end_date: dateSchema('Tanggal selesai').optional(),
    is_active: z.boolean({ error: 'is_active harus boolean' }).optional(),
    categories: categoriesSchema.optional(),
  })
  .superRefine(assertDateRange);

export type CreateBudgetInput = z.infer<typeof createBudgetSchema>;

export type UpdateBudgetInput = z.infer<typeof updateBudgetSchema>;
