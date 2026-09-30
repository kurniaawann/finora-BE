import type { NextFunction, Request, Response } from 'express';

import { findAuthUserById } from '../repositories/user.repository.js';
import { unauthorized } from '../utils/app-error.js';
import { verifyAccessToken } from '../utils/jwt.js';

export const authMiddleware = async (
  req: Request,
  _res: Response,
  next: NextFunction,
) => {
  const [scheme, token] = (req.headers.authorization ?? '').split(' ');

  if (scheme !== 'Bearer' || !token) {
    throw unauthorized(
      'UNAUTHENTICATED',
      'Token autentikasi diperlukan',
    );
  }

  let userId: string;

  try {
    userId = verifyAccessToken(token).id;
  } catch {
    // Aplikasi mobile cukup memanggil /auth/refresh saat menerima kode ini.
    throw unauthorized(
      'INVALID_ACCESS_TOKEN',
      'Token tidak valid atau sudah kedaluwarsa',
    );
  }

  const user = await findAuthUserById(userId);

  if (!user || !user.is_active) {
    throw unauthorized(
      'INVALID_ACCESS_TOKEN',
      'Akun tidak ditemukan atau tidak aktif',
    );
  }

  req.user = {
    id: user.id,
    email: user.email,
    emailVerified: user.email_verified_at !== null,
  };

  next();
};
