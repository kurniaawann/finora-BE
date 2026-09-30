import { z } from 'zod';

export const CATEGORY_TYPES = ['income', 'expense'] as const;

const nameSchema = z
  .string({ error: 'Nama kategori wajib diisi' })
  .trim()
  .min(1, 'Nama kategori wajib diisi')
  .max(100, 'Nama kategori maksimal 100 karakter');

const parentIdSchema = z
  .uuid('ID kategori induk tidak valid')
  .nullable()
  .optional();

// Nama ikon Material, mis. "restaurant" atau "directions_car".
const iconSchema = z
  .string()
  .trim()
  .max(100, 'Ikon maksimal 100 karakter')
  .transform((value) => (value === '' ? null : value))
  .nullable()
  .optional();

const colorSchema = z
  .string()
  .trim()
  .regex(
    /^#[0-9a-fA-F]{6}$/,
    'Format warna harus hex 6 digit, contoh: #FF5733',
  )
  .toUpperCase()
  .nullable()
  .optional();

export const createCategorySchema = z.object({
  name: nameSchema,
  type: z.enum(CATEGORY_TYPES, {
    error: 'Jenis kategori harus income atau expense',
  }),
  parent_id: parentIdSchema,
  icon: iconSchema,
  color: colorSchema,
});

export const updateCategorySchema = z.object({
  name: nameSchema.optional(),
  parent_id: parentIdSchema,
  icon: iconSchema,
  color: colorSchema,
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;

export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
