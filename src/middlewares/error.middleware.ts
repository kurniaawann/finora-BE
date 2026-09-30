import type { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import { ZodError } from 'zod';

import { logger } from '../config/logger.js';
import { MAX_IMAGE_SIZE_MB } from '../config/upload.js';
import { Prisma } from '../generated/prisma/client.js';
import { AppError } from '../utils/app-error.js';
import { fail } from '../utils/response.js';
import { validationError } from './validation.middleware.js';

export const notFoundHandler = (_req: Request, res: Response) => {
  return fail(res, 404, 'Endpoint tidak ditemukan', {
    code: 'ENDPOINT_NOT_FOUND',
  });
};

const handlePrismaError = (
  res: Response,
  error: Prisma.PrismaClientKnownRequestError,
) => {
  switch (error.code) {
    case 'P2002':
      return fail(res, 409, 'Data sudah ada', {
        code: 'DUPLICATE_ENTRY',
      });
    case 'P2003':
      return fail(
        res,
        409,
        'Data masih dipakai oleh data lain',
        { code: 'RESOURCE_IN_USE' },
      );
    case 'P2025':
      return fail(res, 404, 'Data tidak ditemukan', {
        code: 'RESOURCE_NOT_FOUND',
      });
    default:
      return null;
  }
};

/**
 * Error handler terpusat. Express 5 meneruskan promise yang reject
 * dari handler async ke sini, jadi controller tidak perlu try/catch.
 */
export const errorHandler = (
  error: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
) => {
  if (error instanceof AppError) {
    return fail(res, error.statusCode, error.message, {
      code: error.code,
      errors: error.errors,
    });
  }

  if (error instanceof ZodError) {
    const appError = validationError(error);

    return fail(res, 422, appError.message, {
      code: appError.code,
      errors: appError.errors,
    });
  }

  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return fail(
        res,
        413,
        `Ukuran foto maksimal ${MAX_IMAGE_SIZE_MB} MB`,
        { code: 'FILE_TOO_LARGE' },
      );
    }

    return fail(res, 422, 'Unggahan foto tidak valid', {
      code: 'INVALID_UPLOAD',
    });
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const handled = handlePrismaError(res, error);

    if (handled) {
      return handled;
    }
  }

  const httpError = error as {
    status?: number;
    type?: string;
  };

  if (
    error instanceof SyntaxError &&
    httpError.status === 400
  ) {
    return fail(res, 400, 'Format JSON tidak valid', {
      code: 'INVALID_JSON',
    });
  }

  if (httpError.type === 'entity.too.large') {
    return fail(res, 413, 'Ukuran payload terlalu besar', {
      code: 'PAYLOAD_TOO_LARGE',
    });
  }

  logger.error(
    `Unhandled error on ${req.method} ${req.originalUrl}`,
    error,
  );

  return fail(res, 500, 'Terjadi kesalahan pada server', {
    code: 'INTERNAL_ERROR',
  });
};
