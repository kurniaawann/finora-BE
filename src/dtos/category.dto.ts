export interface CategoryParentDTO {
  id: string;
  name: string;
  type: string;
}

export interface CategoryDTO {
  id: string;
  name: string;
  type: string;
  icon: string | null;
  color: string | null;
  parentId: string | null;
  parent: CategoryParentDTO | null;
  isSystem: boolean;
}

export const toCategoryDTO = (category: {
  id: string;
  name: string;
  type: string;
  icon?: string | null;
  color?: string | null;
  parent_id?: string | null;
  categories?: {
    id: string;
    name: string;
    type: string;
  } | null;
  is_system?: boolean;
}): CategoryDTO => ({
  id: category.id,
  name: category.name,
  type: category.type,
  icon: category.icon ?? null,
  color: category.color ?? null,
  parentId: category.parent_id ?? null,
  parent: category.categories ?? null,
  isSystem: category.is_system ?? false,
});