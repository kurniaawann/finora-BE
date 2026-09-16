import type { NextFunction, Request, Response } from 'express';

import { verifyAccessToken } from '../utils/jwt.js';
import { fail } from '../utils/response.js';

export const authMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const authorization = req.headers.authorization;

  if (!authorization) {
    return fail(res, 401, 'Token autentikasi diperlukan');
  }

  const [scheme, token] = authorization.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return fail(res, 401, 'Format token tidak valid');
  }

  try {
    const payload = verifyAccessToken(token);

    req.user = {
      id: payload.id,
    };

    next();
  } catch {
    return fail(
      res,
      401,
      'Token tidak valid atau sudah kedaluwarsa',
    );
  }
};