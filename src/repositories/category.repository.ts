import { prisma } from '../config/database.js';
import type { Prisma } from '../generated/prisma/client.js';
import type { categories_type } from '../generated/prisma/enums.js';

export const createCategory = async (data: {
  userId: string;
  name: string;
  type: categories_type;
  parentId: string | null;
  icon: string | null;
  color: string | null;
}) => {
  return prisma.categories.create({
    data: {
      user_id: data.userId,
      name: data.name,
      type: data.type,
      parent_id: data.parentId,
      icon: data.icon,
      color: data.color,
    },
    include: {
      categories: {
        select: {
          id: true,
          name: true,
          type: true,
        },
      },
    },
  });
};

export const findCategoriesByUser = async (params: {
  userId: string;
  page: number;
  perPage: number;
  type?: categories_type;
  parentId?: string | null;
  search?: string;
}) => {
  const skip = (params.page - 1) * params.perPage;

  const conditions: Prisma.categoriesWhereInput[] = [
    {
      OR: [
        { user_id: params.userId },
        { is_system: true },
      ],
    },
  ];

  if (params.type) {
    conditions.push({ type: params.type });
  }

  if (params.parentId !== undefined) {
    conditions.push({ parent_id: params.parentId });
  }

  if (params.search) {
    conditions.push({
      name: {
        contains: params.search,
      },
    });
  }

  const where: Prisma.categoriesWhereInput = {
    AND: conditions,
  };

  const include = {
    categories: {
      select: {
        id: true,
        name: true,
        type: true,
      },
    },
  };

  const [data, total] = await prisma.$transaction([
    prisma.categories.findMany({
      where,
      orderBy: [
        {
          is_system: 'asc',
        },
        {
          name: 'asc',
        },
      ],
      skip,
      take: params.perPage,
      include,
    }),

    prisma.categories.count({
      where,
    }),
  ]);

  return {
    data,
    total,
    page: params.page,
    perPage: params.perPage,
  };
};

export const findCategoryByIdAndUser = async (
  categoryId: string,
  userId: string,
) => {
  return prisma.categories.findFirst({
    where: {
      id: categoryId,
      OR: [
        { user_id: userId },
        { is_system: true },
      ],
    },
    include: {
      categories: {
        select: {
          id: true,
          name: true,
          type: true,
        },
      },
    },
  });
};

export const findOwnCategoryById = async (
  categoryId: string,
  userId: string,
) => {
  return prisma.categories.findFirst({
    where: {
      id: categoryId,
      user_id: userId,
      is_system: false,
    },
    include: {
      categories: {
        select: {
          id: true,
          name: true,
          type: true,
        },
      },
    },
  });
};

export const findUserCategoryByName = async (
  userId: string,
  name: string,
  type: categories_type,
  parentId: string | null,
) => {
  return prisma.categories.findFirst({
    where: {
      user_id: userId,
      name,
      type,
      parent_id: parentId,
    },
  });
};

export const updateCategory = async (
  categoryId: string,
  userId: string,
  data: {
    name?: string;
    parent_id?: string | null;
    icon?: string | null;
    color?: string | null;
  },
) => {
  return prisma.categories.updateMany({
    where: {
      id: categoryId,
      user_id: userId,
      is_system: false,
    },
    data,
  });
};

export const deleteCategory = async (
  categoryId: string,
  userId: string,
) => {
  return prisma.categories.deleteMany({
    where: {
      id: categoryId,
      user_id: userId,
      is_system: false,
    },
  });
};

export const countChildCategories = async (
  categoryId: string,
) => {
  return prisma.categories.count({
    where: {
      parent_id: categoryId,
    },
  });
};

export const countCategoryReferences = async (
  categoryId: string,
) => {
  const [transactions, budgets, recurring] =
    await prisma.$transaction([
      prisma.transactions.count({
        where: { category_id: categoryId },
      }),
      prisma.budget_categories.count({
        where: { category_id: categoryId },
      }),
      prisma.recurring_transactions.count({
        where: { category_id: categoryId },
      }),
    ]);

  return transactions + budgets + recurring;
};