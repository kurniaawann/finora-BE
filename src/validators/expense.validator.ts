import { z } from 'zod';

export const EXPENSE_CATEGORIES = [
  'food',
  'transport',
  'shopping',
  'entertainment',
  'accommodation',
  'travel',
  'bills',
  'health',
  'education',
  'other',
] as const;

export const EXPENSE_SPLIT_METHODS = [
  'equal',
  'exact',
  'percentage',
  'shares',
  'item',
] as const;

export const EXPENSE_STATUSES = [
  'draft',
  'active',
  'settled',
  'cancelled',
] as const;

export const EXPENSE_PAYMENT_STATUSES = [
  'pending',
  'submitted',
  'confirmed',
  'rejected',
  'cancelled',
] as const;

const MAX_AMOUNT = 999_999_999_999;
const MAX_QUANTITY = 1_000_000;

/** Nominal uang positif, maksimal 2 angka desimal. */
export const moneySchema = (label: string) =>
  z
    .number({ error: `${label} harus berupa angka` })
    .positive(`${label} harus lebih besar dari 0`)
    .max(MAX_AMOUNT, `${label} terlalu besar`)
    .multipleOf(0.01, `${label} maksimal 2 angka desimal`);

export const optionalTextSchema = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label} maksimal ${max} karakter`)
    .transform((value) => (value === '' ? null : value))
    .nullable()
    .optional();

const quantitySchema = (label: string) =>
  z
    .number({ error: `${label} harus berupa angka` })
    .positive(`${label} harus lebih besar dari 0`)
    .max(MAX_QUANTITY, `${label} terlalu besar`);

const participantShape = {
  user_id: z.uuid('ID pengguna tidak valid').nullable().optional(),
  guest_name: z
    .string()
    .trim()
    .min(1, 'Nama tamu wajib diisi')
    .max(255, 'Nama tamu maksimal 255 karakter')
    .nullable()
    .optional(),
};

const requireOneParticipant = (
  data: { user_id?: string | null; guest_name?: string | null },
  ctx: z.RefinementCtx,
) => {
  if (!data.user_id === !data.guest_name) {
    ctx.addIssue({
      code: 'custom',
      path: ['user_id'],
      message: 'Isi salah satu: user_id (anggota) atau guest_name (tamu)',
    });
  }
};

const expenseMemberSchema = z
  .object({
    ...participantShape,
    amount: z
      .number({ error: 'Nominal harus berupa angka' })
      .min(0, 'Nominal tidak boleh negatif')
      .max(MAX_AMOUNT, 'Nominal terlalu besar')
      .multipleOf(0.01, 'Nominal maksimal 2 angka desimal')
      .nullable()
      .optional(),
    percentage: z
      .number({ error: 'Persentase harus berupa angka' })
      .min(0, 'Persentase minimal 0')
      .max(100, 'Persentase maksimal 100')
      .nullable()
      .optional(),
    shares: quantitySchema('Jumlah jatah').nullable().optional(),
    is_payer: z.boolean().optional(),
  })
  .superRefine(requireOneParticipant);

const expenseItemMemberSchema = z
  .object({
    ...participantShape,
    quantity: quantitySchema('Jumlah porsi').default(1),
  })
  .superRefine(requireOneParticipant);

const expenseItemSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Nama item wajib diisi')
    .max(255, 'Nama item maksimal 255 karakter'),
  quantity: quantitySchema('Jumlah item').default(1),
  unit_price: moneySchema('Harga satuan'),
  members: z
    .array(expenseItemMemberSchema)
    .min(1, 'Item wajib dibagi ke minimal satu orang')
    .max(100, 'Maksimal 100 orang per item'),
});

const titleSchema = z
  .string()
  .trim()
  .min(1, 'Judul pengeluaran wajib diisi')
  .max(255, 'Judul pengeluaran maksimal 255 karakter');

const categorySchema = z.enum(EXPENSE_CATEGORIES, {
  error: 'Kategori pengeluaran tidak valid',
});

const splitMethodSchema = z.enum(EXPENSE_SPLIT_METHODS, {
  error: 'Metode pembagian harus equal, exact, percentage, shares, atau item',
});

const expenseDateSchema = z.iso.date({
  error: 'Tanggal pengeluaran harus berformat YYYY-MM-DD',
});

const membersSchema = z
  .array(expenseMemberSchema)
  .max(100, 'Maksimal 100 anggota per pengeluaran');

const itemsSchema = z
  .array(expenseItemSchema)
  .max(200, 'Maksimal 200 item per pengeluaran');

export const createExpenseSchema = z.object({
  title: titleSchema,
  description: optionalTextSchema(1000, 'Deskripsi'),
  category: categorySchema.default('other'),
  total_amount: moneySchema('Total pengeluaran'),
  expense_date: expenseDateSchema,
  split_method: splitMethodSchema.default('equal'),
  event_id: z.uuid('ID acara tidak valid').nullable().optional(),
  members: membersSchema.default([]),
  items: itemsSchema.optional(),
  as_draft: z.boolean().default(false),
});

export const updateExpenseSchema = z.object({
  title: titleSchema.optional(),
  description: optionalTextSchema(1000, 'Deskripsi'),
  category: categorySchema.optional(),
  total_amount: moneySchema('Total pengeluaran').optional(),
  expense_date: expenseDateSchema.optional(),
  split_method: splitMethodSchema.optional(),
  event_id: z.uuid('ID acara tidak valid').nullable().optional(),
  members: membersSchema.optional(),
  items: itemsSchema.optional(),
});

export const createExpensePaymentSchema = z.object({
  amount: moneySchema('Nominal pembayaran'),
  account_id: z.uuid('ID rekening tidak valid').nullable().optional(),
  payment_method_id: z
    .uuid('ID metode pembayaran tidak valid')
    .nullable()
    .optional(),
  paid_at: z.iso
    .datetime({
      offset: true,
      error:
        'Waktu bayar harus berformat ISO 8601, mis. 2026-09-30T14:00:00+07:00',
    })
    .optional(),
  note: optionalTextSchema(500, 'Catatan'),
});

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
export type UpdateExpenseInput = z.infer<typeof updateExpenseSchema>;
export type CreateExpensePaymentInput = z.infer<
  typeof createExpensePaymentSchema
>;
