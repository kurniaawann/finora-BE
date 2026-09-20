import type { NextFunction, Request, Response } from 'express';

import { findUserById } from '../repositories/user.repository.js';
import { verifyAccessToken } from '../utils/jwt.js';
import { fail } from '../utils/response.js';

export const authMiddleware = async (
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

    const user = await findUserById(payload.id);

    if (!user || !user.is_active) {
      return fail(res, 401, 'Akun tidak ditemukan atau tidak aktif');
    }

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