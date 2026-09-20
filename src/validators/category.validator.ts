import { z } from 'zod';

export const categoryTypeSchema = z.enum([
  'income',
  'expense',
]);

const nullableOptionalString = (
  schema: z.ZodString,
) => schema.trim().nullable().optional();

export const createCategorySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Nama kategori wajib diisi')
    .max(100, 'Nama kategori maksimal 100 karakter'),

  type: categoryTypeSchema,

  parent_id: z
    .string()
    .uuid('ID kategori induk tidak valid')
    .nullable()
    .optional(),

  icon: nullableOptionalString(
    z.string().max(100, 'Icon maksimal 100 karakter'),
  ),

  color: nullableOptionalString(
    z
      .string()
      .max(50, 'Warna maksimal 50 karakter')
      .regex(
        /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/,
        'Format warna harus hex, contoh: #FF5733',
      ),
  ),
});

export const updateCategorySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Nama kategori wajib diisi')
    .max(100, 'Nama kategori maksimal 100 karakter')
    .optional(),

  parent_id: z
    .string()
    .uuid('ID kategori induk tidak valid')
    .nullable()
    .optional(),

  icon: nullableOptionalString(
    z.string().max(100, 'Icon maksimal 100 karakter'),
  ),

  color: nullableOptionalString(
    z
      .string()
      .max(50, 'Warna maksimal 50 karakter')
      .regex(
        /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/,
        'Format warna harus hex, contoh: #FF5733',
      ),
  ),
});

export type CreateCategoryInput = z.infer<
  typeof createCategorySchema
>;

export type UpdateCategoryInput = z.infer<
  typeof updateCategorySchema
>;