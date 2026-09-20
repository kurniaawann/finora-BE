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
  parent_id: string | null;
  parent: CategoryParentDTO | null;
  is_system: boolean;
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
  parent_id: category.parent_id ?? null,
  parent: category.categories ?? null,
  is_system: category.is_system ?? false,
});