import type { Request, Response } from 'express';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { getCurrentUser, login, logout, refreshAccessToken, register } from '../services/auth.service.js';
import { toProfileDTO, toUserDTO } from '../dtos/user.dto.js';
import { loginSchema, registerSchema } from '../validators/auth.validator.js';
import { getAuthenticatedUserId } from '../utils/auth.js'
import { fail, success } from '../utils/response.js'

export const registerController = async (
  req: Request,
  res: Response,
) => {
  const validation = registerSchema.safeParse(req.body);

  if (!validation.success) {
    return fail(res, 422, 'Data yang dikirim tidak valid', {
      errors: validation.error.flatten().fieldErrors,
    });
  }

  try {
    await register(validation.data);

    return success(res, 201, 'Registrasi berhasil');
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === 'EMAIL_ALREADY_EXISTS'
    ) {
      return fail(res, 409, 'Email sudah terdaftar');
    }

    logger.error(error);

    return fail(res, 500, 'Terjadi kesalahan pada server');
  }
};
export const loginController = async (
  req: Request,
  res: Response,
) => {
  const validation = loginSchema.safeParse(req.body);

  if (!validation.success) {
    return fail(res, 422, 'Data yang dikirim tidak valid', {
      errors: validation.error.flatten().fieldErrors,
    });
  }

  try {
    const result = await login(validation.data);

    res.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: env.nodeEnv === 'production',
      sameSite: env.nodeEnv === 'production'
        ? 'none'
        : 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000,
      path: '/api/auth',
    });

    return success(res, 200, 'Login berhasil', {
      data: {
        access_token: result.accessToken,
        user: toUserDTO(result.user),
      },
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === 'INVALID_CREDENTIALS'
    ) {
      return fail(res, 401, 'Email atau password salah');
    }

    if (
      error instanceof Error &&
      error.message === 'USER_INACTIVE'
    ) {
      return fail(res, 403, 'Akun Anda tidak aktif');
    }

    logger.error(error);

    return fail(res, 500, 'Terjadi kesalahan pada server');
  }
};

export const meController = async (
  req: Request,
  res: Response,
) => {
  const userId = getAuthenticatedUserId(req);

  if (!userId) {
    return fail(res, 401, 'Autentikasi diperlukan');
  }

  try {
    const user = await getCurrentUser(userId);

    return success(res, 200, 'Data user berhasil diambil', {
      data: {
        user: {
          ...toUserDTO(user),
          profile: user.profile
            ? toProfileDTO(user.profile)
            : null,
        },
      },
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === 'USER_NOT_FOUND'
    ) {
      return fail(res, 404, 'User tidak ditemukan');
    }

    if (
      error instanceof Error &&
      error.message === 'USER_INACTIVE'
    ) {
      return fail(res, 403, 'Akun Anda tidak aktif');
    }

    logger.error(error);

    return fail(res, 500, 'Terjadi kesalahan pada server');
  }
};

export const refreshController = async (
  req: Request,
  res: Response,
) => {
  const refreshToken = req.cookies.refreshToken;

  if (!refreshToken) {
    return fail(res, 401, 'Refresh token tidak ditemukan');
  }

  try {
    const result = await refreshAccessToken(
      refreshToken,
    );

    res.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: env.nodeEnv === 'production',
      sameSite:
        env.nodeEnv === 'production'
          ? 'none'
          : 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000,
      path: '/api/auth',
    });

    return success(res, 200, 'Access token berhasil diperbarui', {
      data: {
        access_token: result.accessToken,
      },
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === 'REFRESH_TOKEN_REUSED'
    ) {
      res.clearCookie('refreshToken', {
        httpOnly: true,
        secure: env.nodeEnv === 'production',
        sameSite:
          env.nodeEnv === 'production'
            ? 'none'
            : 'lax',
        path: '/api/auth',
      });

      return fail(
        res,
        401,
        'Refresh token sudah tidak dapat digunakan',
      );
    }

    if (
      error instanceof Error &&
      error.message === 'REFRESH_TOKEN_EXPIRED'
    ) {
      res.clearCookie('refreshToken', {
        httpOnly: true,
        secure: env.nodeEnv === 'production',
        sameSite:
          env.nodeEnv === 'production'
            ? 'none'
            : 'lax',
        path: '/api/auth',
      });

      return fail(
        res,
        401,
        'Refresh token sudah kedaluwarsa',
      );
    }

    if (
      error instanceof Error &&
      error.message === 'INVALID_REFRESH_TOKEN'
    ) {
      return fail(
        res,
        401,
        'Refresh token tidak valid',
      );
    }

    logger.error(error);

    return fail(res, 500, 'Terjadi kesalahan pada server');
  }
};

export const logoutController = async (
  req: Request,
  res: Response,
) => {
  const refreshToken = req.cookies.refreshToken;

  if (refreshToken) {
    try {
      await logout(refreshToken);
    } catch (error) {
      logger.error(error);
    }
  }

  res.clearCookie('refreshToken', {
    httpOnly: true,
    secure: env.nodeEnv === 'production',
    sameSite: env.nodeEnv === 'production'
      ? 'none'
      : 'lax',
    path: '/api/auth',
  });

  return success(res, 200, 'Logout berhasil');
};