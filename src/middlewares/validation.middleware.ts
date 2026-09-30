import type { NextFunction, Request, Response } from 'express';
import type { ZodError, ZodType } from 'zod';

import { AppError, type FieldErrors } from '../utils/app-error.js';

/**
 * Ubah issue Zod menjadi { "field.path": ["pesan"] } agar field
 * bersarang (mis. members.0.amount) tetap bisa ditandai oleh FE.
 */
export const toFieldErrors = (error: ZodError): FieldErrors => {
  const errors: FieldErrors = {};

  for (const issue of error.issues) {
    const key = issue.path.length > 0
      ? issue.path.join('.')
      : '_root';

    (errors[key] ??= []).push(issue.message);
  }

  return errors;
};

export const validationError = (error: ZodError) =>
  new AppError(
    422,
    'VALIDATION_ERROR',
    'Data yang dikirim tidak valid',
    toFieldErrors(error),
  );

export const validate = (schema: ZodType) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body ?? {});

    if (!result.success) {
      throw validationError(result.error);
    }

    req.body = result.data;

    next();
  };
};
