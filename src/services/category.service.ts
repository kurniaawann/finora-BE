import type { categories_type } from '../generated/prisma/enums.js';
import {
  createCategory as insertCategory,
  deleteCategory as removeCategory,
  findCategories,
  findCategoryByName,
  findUsableCategory,
  hasChildCategories,
  isCategoryInUse,
  updateCategory as saveCategory,
  type CategoryFilters,
} from '../repositories/category.repository.js';
import {
  conflict,
  forbidden,
  notFound,
  unprocessable,
} from '../utils/app-error.js';
import type { PaginationParams } from '../utils/pagination.js';
import type {
  CreateCategoryInput,
  UpdateCategoryInput,
} from '../validators/category.validator.js';

const requireCategory = async (userId: string, categoryId: string) => {
  const category = await findUsableCategory(categoryId, userId);

  if (!category) {
    throw notFound('CATEGORY_NOT_FOUND', 'Kategori tidak ditemukan');
  }

  return category;
};

const requireOwnCategory = async (userId: string, categoryId: string) => {
  const category = await requireCategory(userId, categoryId);

  if (category.is_system || category.user_id !== userId) {
    throw forbidden(
      'CATEGORY_READ_ONLY',
      'Kategori bawaan tidak bisa diubah atau dihapus',
    );
  }

  return category;
};

/** Kategori maksimal 2 level: induk harus kategori level atas bertipe sama. */
const assertValidParent = async (
  userId: string,
  parentId: string,
  type: categories_type,
) => {
  const parent = await findUsableCategory(parentId, userId);

  if (!parent) {
    throw notFound(
      'PARENT_CATEGORY_NOT_FOUND',
      'Kategori induk tidak ditemukan',
    );
  }

  if (parent.type !== type) {
    throw unprocessable(
      'INVALID_PARENT_CATEGORY',
      'Jenis kategori induk harus sama dengan kategori ini',
    );
  }

  if (parent.parent_id) {
    throw unprocessable(
      'INVALID_PARENT_CATEGORY',
      'Sub-kategori tidak bisa menjadi kategori induk',
    );
  }
};

const assertUniqueName = async (params: {
  userId: string;
  name: string;
  type: categories_type;
  parentId: string | null;
  excludeId?: string;
}) => {
  const existing = await findCategoryByName(params);

  if (existing && existing.id !== params.excludeId) {
    throw conflict(
      'CATEGORY_NAME_EXISTS',
      'Nama kategori sudah dipakai di tingkat yang sama',
    );
  }
};

export const listCategories = (
  userId: string,
  pagination: PaginationParams,
  filters: CategoryFilters,
) => findCategories({ userId, ...pagination, filters });

export const getCategory = requireCategory;

export const createCategory = async (
  userId: string,
  input: CreateCategoryInput,
) => {
  const parentId = input.parent_id ?? null;

  if (parentId) {
    await assertValidParent(userId, parentId, input.type);
  }

  await assertUniqueName({
    userId,
    name: input.name,
    type: input.type,
    parentId,
  });

  return insertCategory({
    user_id: userId,
    name: input.name,
    type: input.type,
    parent_id: parentId,
    icon: input.icon ?? null,
    color: input.color ?? null,
    is_system: false,
  });
};

export const updateCategory = async (
  userId: string,
  categoryId: string,
  input: UpdateCategoryInput,
) => {
  const category = await requireOwnCategory(userId, categoryId);

  const parentId =
    input.parent_id !== undefined ? input.parent_id : category.parent_id;

  if (input.parent_id && input.parent_id !== category.parent_id) {
    if (input.parent_id === categoryId) {
      throw unprocessable(
        'INVALID_PARENT_CATEGORY',
        'Kategori tidak bisa menjadi induk dirinya sendiri',
      );
    }

    if (await hasChildCategories(categoryId)) {
      throw unprocessable(
        'INVALID_PARENT_CATEGORY',
        'Kategori yang memiliki sub-kategori tidak bisa dijadikan sub-kategori',
      );
    }

    await assertValidParent(userId, input.parent_id, category.type);
  }

  if (input.name !== undefined || parentId !== category.parent_id) {
    await assertUniqueName({
      userId,
      name: input.name ?? category.name,
      type: category.type,
      parentId,
      excludeId: categoryId,
    });
  }

  return saveCategory(categoryId, {
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.parent_id !== undefined ? { parent_id: input.parent_id } : {}),
    ...(input.icon !== undefined ? { icon: input.icon } : {}),
    ...(input.color !== undefined ? { color: input.color } : {}),
  });
};

export const deleteCategory = async (userId: string, categoryId: string) => {
  await requireOwnCategory(userId, categoryId);

  if (await hasChildCategories(categoryId)) {
    throw conflict(
      'CATEGORY_HAS_CHILDREN',
      'Hapus atau pindahkan sub-kategorinya terlebih dahulu',
    );
  }

  if (await isCategoryInUse(categoryId)) {
    throw conflict(
      'CATEGORY_IN_USE',
      'Kategori masih dipakai transaksi, anggaran, atau transaksi berulang',
    );
  }

  await removeCategory(categoryId);
};
