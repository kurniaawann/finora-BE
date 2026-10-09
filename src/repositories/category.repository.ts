import { prisma } from '../config/database.js';
import type { Prisma } from '../generated/prisma/client.js';
import type { categories_type } from '../generated/prisma/enums.js';

export interface CategoryFilters {
  type?: categories_type;
  /** `null` = hanya kategori level atas. */
  parentId?: string | null;
  search?: string;
}

const categoryInclude = {
  categories: { select: { id: true, name: true } },
} satisfies Prisma.categoriesInclude;

/** Kategori yang boleh dipakai user: milik sendiri atau bawaan sistem. */
const usableBy = (userId: string): Prisma.categoriesWhereInput => ({
  OR: [{ user_id: userId }, { is_system: true }],
});

export const findCategories = async (params: {
  userId: string;
  page: number;
  perPage: number;
  filters: CategoryFilters;
}) => {
  const { type, parentId, search } = params.filters;

  const where: Prisma.categoriesWhereInput = {
    AND: [
      usableBy(params.userId),
      ...(type ? [{ type }] : []),
      ...(parentId !== undefined ? [{ parent_id: parentId }] : []),
      ...(search ? [{ name: { contains: search } }] : []),
    ],
  };

  const [data, total] = await prisma.$transaction([
    prisma.categories.findMany({
      where,
      include: categoryInclude,
      orderBy: [{ is_system: 'asc' }, { name: 'asc' }],
      skip: (params.page - 1) * params.perPage,
      take: params.perPage,
    }),
    prisma.categories.count({ where }),
  ]);

  return { data, total };
};

export const findUsableCategory = (categoryId: string, userId: string) =>
  prisma.categories.findFirst({
    where: { id: categoryId, ...usableBy(userId) },
    include: categoryInclude,
  });

/** Cari kategori bernama sama (tidak peka huruf) di tingkat yang sama. */
export const findCategoryByName = (params: {
  userId: string;
  name: string;
  type: categories_type;
  parentId: string | null;
}) =>
  prisma.categories.findFirst({
    where: {
      ...usableBy(params.userId),
      name: params.name,
      type: params.type,
      parent_id: params.parentId,
    },
    select: { id: true },
  });

export const createCategory = (data: Prisma.categoriesUncheckedCreateInput) =>
  prisma.categories.create({ data, include: categoryInclude });

export const updateCategory = (
  categoryId: string,
  data: Prisma.categoriesUncheckedUpdateInput,
) =>
  prisma.categories.update({
    where: { id: categoryId },
    data,
    include: categoryInclude,
  });

export const deleteCategory = (categoryId: string) =>
  prisma.categories.delete({ where: { id: categoryId } });

export const hasChildCategories = async (categoryId: string) =>
  Boolean(
    await prisma.categories.findFirst({
      where: { parent_id: categoryId },
      select: { id: true },
    }),
  );

export const isCategoryInUse = async (categoryId: string) => {
  const where = { category_id: categoryId };
  const select = { id: true };

  const references = await Promise.all([
    prisma.transactions.findFirst({ where, select }),
    prisma.budget_categories.findFirst({ where, select }),
    prisma.recurring_transactions.findFirst({ where, select }),
  ]);

  return references.some(Boolean);
};
