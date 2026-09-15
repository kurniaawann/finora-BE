export interface PaginationParams {
  page: number;
  perPage: number;
}

export interface PaginationMeta {
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
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
  const rawPerPage = Number(query.perPage);

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
    perPage: pagination.perPage,
    total,
    totalPages,
    hasNextPage: pagination.page < totalPages,
    hasPrevPage: pagination.page > 1,
  };
};