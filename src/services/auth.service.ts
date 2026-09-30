import crypto from 'node:crypto';

import { prisma } from '../config/database.js';
import type { AuthTokensDTO } from '../dtos/user.dto.js';
import {
  createRefreshToken,
  findRefreshToken,
  revokeAllUserRefreshTokens,
  revokeRefreshToken,
  rotateRefreshToken,
} from '../repositories/refresh-token.js';
import { deleteUserDeviceTokens } from '../repositories/device-token.repository.js';
import {
  anonymizeUser,
  createUser,
  findUserByEmail,
  findUserById,
  markEmailVerified,
  updateUserPassword,
} from '../repositories/user.repository.js';
import {
  AppError,
  conflict,
  forbidden,
  notFound,
  unauthorized,
  unprocessable,
} from '../utils/app-error.js';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} from '../utils/jwt.js';
import { comparePassword, hashPassword } from '../utils/password.js';
import { hashToken } from '../utils/token.js';
import type {
  ChangePasswordInput,
  DeleteAccountInput,
  LoginInput,
  RegisterInput,
  ResetPasswordInput,
} from '../validators/auth.validator.js';
import { getMemberNetBalance } from './balance.service.js';
import { buildCodeEmail, sendMailInBackground } from './mail.service.js';
import { deleteImage } from './storage.service.js';
import {
  CODE_TTL_MINUTES,
  consumeVerificationCode,
  isInResendCooldown,
  issueVerificationCode,
} from './verification.service.js';

// Dipakai saat email tidak terdaftar agar waktu respons login tetap
// setara dan tidak bisa dipakai untuk menebak email yang terdaftar.
const DUMMY_PASSWORD_HASH =
  '$2b$12$2Sraj/Tz3OCPSIXrLqmLeu1Vs1fgAan/BEPcvXeGIrijRhOKjFJV2';

const invalidRefreshToken = () =>
  unauthorized(
    'INVALID_REFRESH_TOKEN',
    'Sesi tidak valid, silakan login ulang',
  );

/** Buat pasangan token baru dan simpan hash refresh token-nya. */
const issueTokens = async (userId: string): Promise<AuthTokensDTO> => {
  const access = generateAccessToken(userId);
  const refresh = generateRefreshToken(userId);

  await createRefreshToken({
    userId,
    tokenHash: hashToken(refresh.token),
    expiresAt: refresh.expiresAt,
  });

  return {
    access_token: access.token,
    refresh_token: refresh.token,
    token_type: 'Bearer',
    expires_in: access.expiresIn,
  };
};

const requireActiveUser = async (userId: string) => {
  const user = await findUserById(userId);

  if (!user) {
    throw notFound('USER_NOT_FOUND', 'User tidak ditemukan');
  }

  if (!user.is_active) {
    throw forbidden('USER_INACTIVE', 'Akun kamu tidak aktif');
  }

  return user;
};

const sendVerificationEmail = async (user: {
  id: string;
  name: string;
  email: string;
}) => {
  const code = await issueVerificationCode(user.id, 'email_verification');

  sendMailInBackground(
    buildCodeEmail({
      to: user.email,
      name: user.name,
      subject: `${code} adalah kode verifikasi email Finora`,
      intro: 'Masukkan kode berikut di aplikasi Finora untuk memverifikasi email kamu.',
      code,
      expiresInMinutes: CODE_TTL_MINUTES,
    }),
  );
};

/** Cabut semua sesi & perangkat (dipakai saat password berubah). */
const revokeAllAccess = async (userId: string) => {
  await revokeAllUserRefreshTokens(userId);
  await deleteUserDeviceTokens(userId);
};

export const register = async (input: RegisterInput) => {
  const existing = await findUserByEmail(input.email);

  if (existing) {
    throw conflict('EMAIL_ALREADY_EXISTS', 'Email sudah terdaftar');
  }

  const user = await createUser({
    name: input.name,
    email: input.email,
    password: await hashPassword(input.password),
  });

  await sendVerificationEmail(user);

  return {
    user,
    tokens: await issueTokens(user.id),
  };
};

export const login = async (input: LoginInput) => {
  const user = await findUserByEmail(input.email);

  const passwordValid = await comparePassword(
    input.password,
    user?.password ?? DUMMY_PASSWORD_HASH,
  );

  if (!user || !passwordValid) {
    throw unauthorized(
      'INVALID_CREDENTIALS',
      'Email atau password salah',
    );
  }

  if (!user.is_active) {
    throw forbidden('USER_INACTIVE', 'Akun kamu tidak aktif');
  }

  return {
    user,
    tokens: await issueTokens(user.id),
  };
};

export const getCurrentUser = requireActiveUser;

/**
 * Rotasi refresh token. Token lama langsung dicabut; bila token yang
 * sudah dicabut dipakai lagi (indikasi pencurian), seluruh sesi user
 * dicabut sesuai rekomendasi OWASP.
 */
export const refreshTokens = async (
  refreshToken: string,
): Promise<AuthTokensDTO> => {
  let payload;

  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw invalidRefreshToken();
  }

  const stored = await findRefreshToken(hashToken(refreshToken));

  if (!stored || stored.user_id !== payload.id) {
    throw invalidRefreshToken();
  }

  if (stored.revoked_at) {
    await revokeAllUserRefreshTokens(stored.user_id);

    throw unauthorized(
      'REFRESH_TOKEN_REUSED',
      'Sesi sudah tidak berlaku, silakan login ulang',
    );
  }

  if (stored.expires_at < new Date()) {
    throw unauthorized(
      'REFRESH_TOKEN_EXPIRED',
      'Sesi sudah berakhir, silakan login ulang',
    );
  }

  const user = await findUserById(stored.user_id);

  if (!user || !user.is_active) {
    throw invalidRefreshToken();
  }

  const access = generateAccessToken(stored.user_id);
  const refresh = generateRefreshToken(stored.user_id);

  try {
    await rotateRefreshToken({
      oldTokenId: stored.id,
      newToken: {
        userId: stored.user_id,
        tokenHash: hashToken(refresh.token),
        expiresAt: refresh.expiresAt,
      },
    });
  } catch (error) {
    // Token lama sudah dirotasi request lain secara bersamaan (race).
    if (
      error instanceof Error &&
      error.message === 'REFRESH_TOKEN_REUSED'
    ) {
      await revokeAllUserRefreshTokens(stored.user_id);

      throw unauthorized(
        'REFRESH_TOKEN_REUSED',
        'Sesi sudah tidak berlaku, silakan login ulang',
      );
    }

    throw error;
  }

  return {
    access_token: access.token,
    refresh_token: refresh.token,
    token_type: 'Bearer',
    expires_in: access.expiresIn,
  };
};

/** Logout satu perangkat. Token tak dikenal diabaikan (idempotent). */
export const logout = async (refreshToken: string) => {
  const stored = await findRefreshToken(hashToken(refreshToken));

  if (stored && !stored.revoked_at) {
    await revokeRefreshToken(stored.id);
  }
};

/** Keluar dari semua perangkat (sesi & token push). */
export const logoutAll = revokeAllAccess;

/**
 * Ganti password: semua sesi lain dicabut, perangkat saat ini
 * mendapat token baru agar tetap login.
 */
export const changePassword = async (
  userId: string,
  input: ChangePasswordInput,
) => {
  const user = await requireActiveUser(userId);

  const valid = await comparePassword(
    input.current_password,
    user.password,
  );

  if (!valid) {
    throw unprocessable(
      'INVALID_CURRENT_PASSWORD',
      'Password lama tidak sesuai',
    );
  }

  await updateUserPassword(userId, await hashPassword(input.new_password));
  await revokeAllAccess(userId);

  return issueTokens(userId);
};

/**
 * Lupa password: selalu sukses dari sisi client agar tidak bisa dipakai
 * untuk menebak email terdaftar. Kode hanya dikirim ke akun aktif dan
 * paling cepat 60 detik sekali.
 */
export const requestPasswordReset = async (email: string) => {
  const user = await findUserByEmail(email);

  if (
    !user ||
    !user.is_active ||
    (await isInResendCooldown(user.id, 'password_reset'))
  ) {
    return;
  }

  const code = await issueVerificationCode(user.id, 'password_reset');

  sendMailInBackground(
    buildCodeEmail({
      to: user.email,
      name: user.name,
      subject: `${code} adalah kode reset password Finora`,
      intro: 'Kami menerima permintaan untuk mengatur ulang password akun Finora kamu. Masukkan kode berikut di aplikasi.',
      code,
      expiresInMinutes: CODE_TTL_MINUTES,
    }),
  );
};

/**
 * Reset password dengan kode OTP. Semua sesi & perangkat dicabut;
 * user login ulang dengan password baru. Kode yang valid sekaligus
 * membuktikan kepemilikan email.
 */
export const resetPassword = async (input: ResetPasswordInput) => {
  const user = await findUserByEmail(input.email);

  const valid =
    user !== null &&
    user.is_active &&
    (await consumeVerificationCode(user.id, 'password_reset', input.code));

  if (!user || !valid) {
    throw unprocessable(
      'INVALID_RESET_CODE',
      'Kode tidak valid atau sudah kedaluwarsa',
    );
  }

  await updateUserPassword(user.id, await hashPassword(input.new_password));
  await revokeAllAccess(user.id);

  if (!user.email_verified_at) {
    await markEmailVerified(user.id);
  }
};

export const resendEmailVerification = async (userId: string) => {
  const user = await requireActiveUser(userId);

  if (user.email_verified_at) {
    throw conflict('EMAIL_ALREADY_VERIFIED', 'Email sudah terverifikasi');
  }

  if (await isInResendCooldown(userId, 'email_verification')) {
    throw new AppError(
      429,
      'VERIFICATION_COOLDOWN',
      'Tunggu 1 menit sebelum meminta kode baru',
    );
  }

  await sendVerificationEmail(user);
};

export const verifyEmail = async (userId: string, code: string) => {
  const user = await requireActiveUser(userId);

  if (user.email_verified_at) {
    throw conflict('EMAIL_ALREADY_VERIFIED', 'Email sudah terverifikasi');
  }

  if (!(await consumeVerificationCode(userId, 'email_verification', code))) {
    throw unprocessable(
      'INVALID_VERIFICATION_CODE',
      'Kode tidak valid atau sudah kedaluwarsa',
    );
  }

  return markEmailVerified(userId);
};

/**
 * Hapus akun (wajib tersedia di aplikasi mobile menurut kebijakan
 * App Store/Play Store). Ditolak bila user masih punya utang-piutang
 * atau masih menjadi pemilik grup yang beranggota lain.
 */
export const deleteAccount = async (
  userId: string,
  input: DeleteAccountInput,
) => {
  const user = await requireActiveUser(userId);

  if (!(await comparePassword(input.password, user.password))) {
    throw unprocessable('INVALID_PASSWORD', 'Password tidak sesuai');
  }

  const memberships = await prisma.group_members.findMany({
    where: { user_id: userId },
    select: {
      group_id: true,
      role: true,
      groups: {
        select: { _count: { select: { group_members: true } } },
      },
    },
  });

  const ownsSharedGroup = memberships.some(
    (membership) =>
      membership.role === 'owner' &&
      membership.groups._count.group_members > 1,
  );

  if (ownsSharedGroup) {
    throw conflict(
      'OWNERSHIP_TRANSFER_REQUIRED',
      'Pindahkan kepemilikan grup yang masih beranggota sebelum menghapus akun',
    );
  }

  for (const membership of memberships) {
    const net = await getMemberNetBalance(membership.group_id, userId);

    if (Math.abs(net) >= 0.01) {
      throw conflict(
        'OUTSTANDING_BALANCE',
        'Selesaikan utang-piutang di semua grup sebelum menghapus akun',
      );
    }
  }

  // Grup yang hanya berisi dirinya sendiri ikut dihapus.
  const soloGroupIds = memberships
    .filter((membership) => membership.role === 'owner')
    .map((membership) => membership.group_id);

  if (soloGroupIds.length > 0) {
    await prisma.groups.deleteMany({
      where: { id: { in: soloGroupIds } },
    });
  }

  await prisma.group_members.deleteMany({ where: { user_id: userId } });

  const avatar = user.profiles?.avatar_url;
  const randomPassword = await hashPassword(
    crypto.randomBytes(32).toString('hex'),
  );

  await anonymizeUser(userId, randomPassword);
  await deleteImage(avatar);
};
