import type { Response } from 'express';

interface SuccessOptions {
  data?: unknown;
  [key: string]: unknown;
}

interface FailOptions {
  errors?: unknown;
  [key: string]: unknown;
}

export const success = (
  res: Response,
  statusCode: number,
  message: string,
  options: SuccessOptions = {},
) => {
  const { data, ...rest } = options;

  return res.status(statusCode).json({
    success: true,
    status_code: statusCode,
    message,
    ...rest,
    ...(data !== undefined && {
      data,
    }),
  });
};

export const fail = (
  res: Response,
  statusCode: number,
  message: string,
  options: FailOptions = {},
) => {
  const { errors, ...rest } = options;

  return res.status(statusCode).json({
    success: false,
    status_code: statusCode,
    message,
    ...rest,
    ...(errors !== undefined && {
      errors,
    }),
  });
};