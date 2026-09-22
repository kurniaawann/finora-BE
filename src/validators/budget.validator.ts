import { z } from 'zod';

export const budgetCategorySchema = z.object({
  category_id: z
    .string()
    .uuid('Category ID tidak valid'),

  amount: z
    .number()
    .positive(
      'Nominal alokasi harus lebih besar dari 0',
    ),
});

const dateSchema = z
  .string()
  .date('Tanggal tidak valid, gunakan format YYYY-MM-DD');

const addDuplicateCategoryIssue = (
  categories:
    | { category_id: string }[]
    | undefined,
  ctx: z.RefinementCtx,
) => {
  const ids = (categories ?? []).map(
    (category) => category.category_id,
  );

  if (new Set(ids).size !== ids.length) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['categories'],
      message: 'Kategori tidak boleh duplikat',
    });
  }
};

export const createBudgetSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, 'Nama budget wajib diisi')
      .max(
        255,
        'Nama budget maksimal 255 karakter',
      ),

    amount: z
      .number()
      .positive(
        'Total budget harus lebih besar dari 0',
      ),

    start_date: dateSchema,
    end_date: dateSchema,

    is_active: z.boolean().optional(),

    categories: z
      .array(budgetCategorySchema)
      .optional(),
  })
  .superRefine((data, ctx) => {
    addDuplicateCategoryIssue(data.categories, ctx);
  });

export const updateBudgetSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, 'Nama budget wajib diisi')
      .max(
        255,
        'Nama budget maksimal 255 karakter',
      )
      .optional(),

    amount: z
      .number()
      .positive(
        'Total budget harus lebih besar dari 0',
      )
      .optional(),

    start_date: dateSchema.optional(),
    end_date: dateSchema.optional(),

    is_active: z.boolean().optional(),

    categories: z
      .array(budgetCategorySchema)
      .optional(),
  })
  .superRefine((data, ctx) => {
    addDuplicateCategoryIssue(data.categories, ctx);
  });

export type CreateBudgetInput = z.infer<
  typeof createBudgetSchema
>;

export type UpdateBudgetInput = z.infer<
  typeof updateBudgetSchema
>;
