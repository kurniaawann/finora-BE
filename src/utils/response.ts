import type { Response } from 'express';

import type { PaginationMeta } from './pagination.js';
import type { FieldErrors } from './app-error.js';

interface SuccessOptions {
  data?: unknown;
  pagination?: PaginationMeta;
}

interface FailOptions {
  code?: string;
  errors?: FieldErrors;
}

/**
 * Bentuk respons sukses:
 * { success, status_code, message, data?, pagination? }
 */
export const success = (
  res: Response,
  statusCode: number,
  message: string,
  options: SuccessOptions = {},
) => {
  return res.status(statusCode).json({
    success: true,
    status_code: statusCode,
    message,
    ...(options.data !== undefined && { data: options.data }),
    ...(options.pagination !== undefined && {
      pagination: options.pagination,
    }),
  });
};

/**
 * Bentuk respons gagal:
 * { success, status_code, code, message, errors? }
 */
export const fail = (
  res: Response,
  statusCode: number,
  message: string,
  options: FailOptions = {},
) => {
  return res.status(statusCode).json({
    success: false,
    status_code: statusCode,
    code: options.code ?? 'ERROR',
    message,
    ...(options.errors !== undefined && {
      errors: options.errors,
    }),
  });
};
