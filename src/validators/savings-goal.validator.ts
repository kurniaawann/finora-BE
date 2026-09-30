import { z } from 'zod';

const MAX_AMOUNT = 999_999_999_999;

const amount = (label: string) =>
  z
    .number({ error: `${label} harus berupa angka` })
    .positive(`${label} harus lebih dari 0`)
    .max(MAX_AMOUNT, `${label} terlalu besar`)
    .refine(
      (value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-6,
      `${label} maksimal 2 angka desimal`,
    );

const dateOnly = (label: string) =>
  z.iso.date({ error: `${label} harus berformat YYYY-MM-DD` });

const nullableText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label} maksimal ${max} karakter`)
    .transform((value) => (value === '' ? null : value))
    .nullable()
    .optional();

const goalName = z
  .string({ error: 'Nama target wajib diisi' })
  .trim()
  .min(1, 'Nama target wajib diisi')
  .max(255, 'Nama target maksimal 255 karakter');

const shareToken = z
  .string({ error: 'Token berbagi wajib diisi' })
  .trim()
  .min(1, 'Token berbagi wajib diisi')
  .max(64, 'Token berbagi tidak valid');

export const createSavingsGoalSchema = z.object({
  name: goalName,
  target_amount: amount('Nominal target'),
  target_date: dateOnly('Tanggal target').nullable().optional(),
  icon: nullableText(100, 'Ikon'),
  color: nullableText(50, 'Warna'),
  description: nullableText(500, 'Deskripsi'),
});

export const updateSavingsGoalSchema = z.object({
  name: goalName.optional(),
  target_amount: amount('Nominal target').optional(),
  target_date: dateOnly('Tanggal target').nullable().optional(),
  icon: nullableText(100, 'Ikon'),
  color: nullableText(50, 'Warna'),
  description: nullableText(500, 'Deskripsi'),
  is_completed: z
    .boolean({ error: 'is_completed harus bernilai true/false' })
    .optional(),
});

export const joinSavingsGoalSchema = z.object({
  share_token: shareToken,
});

export const addSavingsContributionSchema = z.object({
  amount: amount('Nominal setoran'),
  account_id: z.uuid('ID rekening tidak valid').nullable().optional(),
  payment_method_id: z
    .uuid('ID metode pembayaran tidak valid')
    .nullable()
    .optional(),
  contribution_date: dateOnly('Tanggal setoran').optional(),
  note: nullableText(500, 'Catatan'),
  share_token: shareToken.nullable().optional(),
});

export const updateSavingsContributionSchema = z.object({
  amount: amount('Nominal setoran').optional(),
  account_id: z.uuid('ID rekening tidak valid').nullable().optional(),
  payment_method_id: z
    .uuid('ID metode pembayaran tidak valid')
    .nullable()
    .optional(),
  contribution_date: dateOnly('Tanggal setoran').optional(),
  note: nullableText(500, 'Catatan'),
});

export type CreateSavingsGoalInput = z.infer<typeof createSavingsGoalSchema>;
export type UpdateSavingsGoalInput = z.infer<typeof updateSavingsGoalSchema>;
export type JoinSavingsGoalInput = z.infer<typeof joinSavingsGoalSchema>;
export type AddSavingsContributionInput = z.infer<
  typeof addSavingsContributionSchema
>;
export type UpdateSavingsContributionInput = z.infer<
  typeof updateSavingsContributionSchema
>;
