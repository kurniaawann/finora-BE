import type { NextFunction, Request, Response } from 'express';
import type { ZodType } from 'zod';

export const validate = (schema: ZodType) => {
  return (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      return res.status(422).json({
        success: false,
        message: 'Data yang dikirim tidak valid',
        errors: result.error.flatten().fieldErrors,
      });
    }

    req.body = result.data;

    next();
  };
};