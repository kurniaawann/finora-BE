import {
  countCategoryReferences,
  countChildCategories,
  createCategory,
  deleteCategory,
  findCategoriesByUser,
  findCategoryByIdAndUser,
  findOwnCategoryById,
  findUserCategoryByName,
  updateCategory,
} from '../repositories/category.repository.js';

import type {
  CreateCategoryInput,
  UpdateCategoryInput,
} from '../validators/category.validator.js';

import type { categories_type } from '../generated/prisma/enums.js';

const validateParentCategory = async (
  userId: string,
  parentId: string | null | undefined,
  type: categories_type,
) => {
  const parent = parentId
    ? await findCategoryByIdAndUser(parentId, userId)
    : null;

  if (parentId && !parent) {
    throw new Error('PARENT_CATEGORY_NOT_FOUND');
  }

  if (parent && parent.type !== type) {
    throw new Error('INVALID_PARENT_CATEGORY_TYPE');
  }

  return parent;
};

export const create = async (
  userId: string,
  input: CreateCategoryInput,
) => {
  const parentId = input.parent_id ?? null;

  await validateParentCategory(
    userId,
    parentId,
    input.type,
  );

  const duplicate = await findUserCategoryByName(
    userId,
    input.name,
    input.type,
    parentId,
  );

  if (duplicate) {
    throw new Error('CATEGORY_NAME_EXISTS');
  }

  return createCategory({
    userId,
    name: input.name,
    type: input.type,
    parentId,
    icon: input.icon ?? null,
    color: input.color ?? null,
  });
};

export const getAll = async (
  userId: string,
  page: number,
  perPage: number,
  type?: categories_type,
  parentId?: string | null,
  search?: string,
) => {
  return findCategoriesByUser({
    userId,
    page,
    perPage,
    type,
    parentId,
    search,
  });
};

export const getById = async (
  userId: string,
  categoryId: string,
) => {
  const category = await findCategoryByIdAndUser(
    categoryId,
    userId,
  );

  if (!category) {
    throw new Error('CATEGORY_NOT_FOUND');
  }

  return category;
};

export const update = async (
  userId: string,
  categoryId: string,
  input: UpdateCategoryInput,
) => {
  const category = await findOwnCategoryById(
    categoryId,
    userId,
  );

  if (!category) {
    throw new Error('CATEGORY_NOT_FOUND');
  }

  if (input.parent_id === categoryId) {
    throw new Error('SELF_PARENT_NOT_ALLOWED');
  }

  if (input.parent_id !== undefined) {
    await validateParentCategory(
      userId,
      input.parent_id,
      category.type,
    );
  }

  if (input.name !== undefined) {
    const duplicate = await findUserCategoryByName(
      userId,
      input.name,
      category.type,
      input.parent_id ?? category.parent_id ?? null,
    );

    if (duplicate && duplicate.id !== categoryId) {
      throw new Error('CATEGORY_NAME_EXISTS');
    }
  }

  await updateCategory(
    categoryId,
    userId,
    {
      ...(input.name !== undefined
        ? { name: input.name }
        : {}),
      ...(input.parent_id !== undefined
        ? { parent_id: input.parent_id }
        : {}),
      ...(input.icon !== undefined
        ? { icon: input.icon }
        : {}),
      ...(input.color !== undefined
        ? { color: input.color }
        : {}),
    },
  );

  return findOwnCategoryById(categoryId, userId);
};

export const remove = async (
  userId: string,
  categoryId: string,
) => {
  const category = await findOwnCategoryById(
    categoryId,
    userId,
  );

  if (!category) {
    throw new Error('CATEGORY_NOT_FOUND');
  }

  const children = await countChildCategories(categoryId);

  if (children > 0) {
    throw new Error('CATEGORY_HAS_CHILDREN');
  }

  const references = await countCategoryReferences(
    categoryId,
  );

  if (references > 0) {
    throw new Error('CATEGORY_IN_USE');
  }

  const result = await deleteCategory(
    categoryId,
    userId,
  );

  if (result.count === 0) {
    throw new Error('CATEGORY_NOT_FOUND');
  }

  return true;
};