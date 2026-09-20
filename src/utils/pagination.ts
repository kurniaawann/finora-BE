export interface PaginationParams {
  page: number;
  perPage: number;
}

export interface PaginationMeta {
  page: number;
  per_page: number;
  total: number;
  total_pages: number;
  has_next_page: boolean;
  has_prev_page: boolean;
}

export const DEFAULT_PER_PAGE = 10;
export const MAX_PER_PAGE = 100;

export type PaginationQuery = Record<
  string,
  unknown
>;

export const parsePagination = (
  query: PaginationQuery,
): PaginationParams => {
  const rawPage = Number(query.page);
  const rawPerPage = Number(
    query.per_page ?? query.perPage,
  );

  const page =
    Number.isInteger(rawPage) && rawPage > 0
      ? rawPage
      : 1;

  const perPage =
    Number.isInteger(rawPerPage) &&
    rawPerPage > 0
      ? Math.min(rawPerPage, MAX_PER_PAGE)
      : DEFAULT_PER_PAGE;

  return {
    page,
    perPage,
  };
};

export const buildPaginationMeta = (
  pagination: PaginationParams,
  total: number,
): PaginationMeta => {
  const totalPages = Math.max(
    1,
    Math.ceil(total / pagination.perPage),
  );

  return {
    page: pagination.page,
    per_page: pagination.perPage,
    total,
    total_pages: totalPages,
    has_next_page: pagination.page < totalPages,
    has_prev_page: pagination.page > 1,
  };
};