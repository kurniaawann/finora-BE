export interface CategoryDTO {
  id: string;
  name: string;
  type: string;
  icon: string | null;
  color: string | null;
  parent: { id: string; name: string } | null;
  is_system: boolean;
}

export const toCategoryDTO = (category: {
  id: string;
  name: string;
  type: string;
  icon: string | null;
  color: string | null;
  is_system: boolean;
  categories: { id: string; name: string } | null;
}): CategoryDTO => ({
  id: category.id,
  name: category.name,
  type: category.type,
  icon: category.icon,
  color: category.color,
  parent: category.categories
    ? { id: category.categories.id, name: category.categories.name }
    : null,
  is_system: category.is_system,
});
