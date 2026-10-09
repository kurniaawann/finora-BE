import type { Request, Response } from 'express';

import { toMeDTO } from '../dtos/user.dto.js';
import {
  changePassword,
  deleteAccount,
  getCurrentUser,
  login,
  logout,
  logoutAll,
  refreshTokens,
  register,
  requestPasswordReset,
  resendEmailVerification,
  resetPassword,
  verifyEmail,
} from '../services/auth.service.js';
import { getAuthenticatedUserId } from '../utils/auth.js';
import { success } from '../utils/response.js';

export const registerController = async (req: Request, res: Response) => {
  const { user, tokens } = await register(req.body);

  return success(res, 201, 'Registrasi berhasil', {
    data: { ...tokens, user: toMeDTO(user) },
  });
};

export const loginController = async (req: Request, res: Response) => {
  const { user, tokens } = await login(req.body);

  return success(res, 200, 'Login berhasil', {
    data: { ...tokens, user: toMeDTO(user) },
  });
};

export const refreshController = async (req: Request, res: Response) => {
  const tokens = await refreshTokens(req.body.refresh_token);

  return success(res, 200, 'Token berhasil diperbarui', {
    data: tokens,
  });
};

export const logoutController = async (req: Request, res: Response) => {
  await logout(req.body.refresh_token);

  return success(res, 200, 'Logout berhasil');
};

export const logoutAllController = async (req: Request, res: Response) => {
  await logoutAll(getAuthenticatedUserId(req));

  return success(res, 200, 'Berhasil keluar dari semua perangkat');
};

export const meController = async (req: Request, res: Response) => {
  const user = await getCurrentUser(getAuthenticatedUserId(req));

  return success(res, 200, 'Data user berhasil diambil', {
    data: toMeDTO(user),
  });
};

export const changePasswordController = async (
  req: Request,
  res: Response,
) => {
  const tokens = await changePassword(
    getAuthenticatedUserId(req),
    req.body,
  );

  return success(res, 200, 'Password berhasil diubah', {
    data: tokens,
  });
};

export const deleteAccountController = async (
  req: Request,
  res: Response,
) => {
  await deleteAccount(getAuthenticatedUserId(req), req.body);

  return success(res, 200, 'Akun berhasil dihapus');
};

export const forgotPasswordController = async (
  req: Request,
  res: Response,
) => {
  await requestPasswordReset(req.body.email);

  return success(
    res,
    200,
    'Jika email terdaftar, kode reset password sudah dikirim',
  );
};

export const resetPasswordController = async (
  req: Request,
  res: Response,
) => {
  await resetPassword(req.body);

  return success(res, 200, 'Password berhasil direset, silakan login');
};

export const resendVerificationController = async (
  req: Request,
  res: Response,
) => {
  await resendEmailVerification(getAuthenticatedUserId(req));

  return success(res, 200, 'Kode verifikasi sudah dikirim ke email kamu');
};

export const verifyEmailController = async (req: Request, res: Response) => {
  const user = await verifyEmail(getAuthenticatedUserId(req), req.body.code);

  return success(res, 200, 'Email berhasil diverifikasi', {
    data: toMeDTO(user),
  });
};
