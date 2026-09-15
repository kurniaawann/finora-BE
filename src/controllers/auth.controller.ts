import type { Request, Response } from 'express';
import { env } from '../config/env.js';
import { getCurrentUser, login, logout, refreshAccessToken, register } from '../services/auth.service.js';
import { loginSchema, registerSchema } from '../validators/auth.validator.js';

export const registerController = async (
  req: Request,
  res: Response,
) => {
  const validation = registerSchema.safeParse(req.body);

  if (!validation.success) {
    return res.status(422).json({
      success: false,
      message: 'Data yang dikirim tidak valid',
      errors: validation.error.flatten().fieldErrors,
    });
  }

  try {
    const user = await register(validation.data);

    return res.status(201).json({
      success: true,
      message: 'Registrasi berhasil',
      data: {
        user,
      },
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === 'EMAIL_ALREADY_EXISTS'
    ) {
      return res.status(409).json({
        success: false,
        message: 'Email sudah terdaftar',
      });
    }

    console.error(error);

    return res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan pada server',
    });
  }
};
export const loginController = async (
  req: Request,
  res: Response,
) => {
  const validation = loginSchema.safeParse(req.body);

  if (!validation.success) {
    return res.status(422).json({
      success: false,
      message: 'Data yang dikirim tidak valid',
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
    
    return res.status(200).json({
      success: true,
      message: 'Login berhasil',
      data: {
        accessToken: result.accessToken,
        user: result.user,
      },
    });
    // return res.status(200).json({
    //   success: true,
    //   message: 'Login berhasil',
    //   data: result,
    // });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === 'INVALID_CREDENTIALS'
    ) {
      return res.status(401).json({
        success: false,
        message: 'Email atau password salah',
      });
    }

    if (
      error instanceof Error &&
      error.message === 'USER_INACTIVE'
    ) {
      return res.status(403).json({
        success: false,
        message: 'Akun Anda tidak aktif',
      });
    }

    console.error(error);

    return res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan pada server',
    });
  }
};

export const meController = async (
  req: Request,
  res: Response,
) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Autentikasi diperlukan',
    });
  }

  try {
    const user = await getCurrentUser(req.user.id);

    return res.status(200).json({
      success: true,
      message: 'Data user berhasil diambil',
      data: {
        user,
      },
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === 'USER_NOT_FOUND'
    ) {
      return res.status(404).json({
        success: false,
        message: 'User tidak ditemukan',
      });
    }

    if (
      error instanceof Error &&
      error.message === 'USER_INACTIVE'
    ) {
      return res.status(403).json({
        success: false,
        message: 'Akun Anda tidak aktif',
      });
    }

    console.error(error);

    return res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan pada server',
    });
  }
};

export const refreshController = async (
  req: Request,
  res: Response,
) => {
  const refreshToken = req.cookies.refreshToken;

  if (!refreshToken) {
    return res.status(401).json({
      success: false,
      message: 'Refresh token tidak ditemukan',
    });
  }

  try {
    const result = await refreshAccessToken(
      refreshToken,
    );

    return res.status(200).json({
      success: true,
      message: 'Access token berhasil diperbarui',
      data: result,
    });
  } catch (error) {
    if (
      error instanceof Error &&
      (
        error.message === 'INVALID_REFRESH_TOKEN' ||
        error.message === 'REFRESH_TOKEN_EXPIRED'
      )
    ) {
      return res.status(401).json({
        success: false,
        message: 'Refresh token tidak valid atau sudah kedaluwarsa',
      });
    }

    console.error(error);

    return res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan pada server',
    });
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
      console.error(error);
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

  return res.status(200).json({
    success: true,
    message: 'Logout berhasil',
  });
};