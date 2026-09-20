import {
  createRefreshToken,
  findRefreshToken,
  pruneExpiredRefreshTokens,
  revokeAllUserRefreshTokens,
  revokeRefreshToken,
  rotateRefreshToken,
} from '../repositories/refresh-token.js';
import {
  createUser,
  findUserByEmail,
  findUserByEmailGetProfile,
  findUserById,
} from '../repositories/user.repository.js';
import { getRefreshTokenExpiry } from '../utils/date.js';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../utils/jwt.js';
import { logger } from '../config/logger.js';

import { comparePassword, hashPassword } from '../utils/password.js';
import { hashToken } from '../utils/token.js';
import type { LoginInput, RegisterInput } from '../validators/auth.validator.js';

const PRUNE_INTERVAL_MS = 60 * 60 * 1000;

let lastPruneAt = 0;

const pruneRefreshTokensIfNeeded = async () => {
  const now = Date.now();

  if (now - lastPruneAt < PRUNE_INTERVAL_MS) {
    return;
  }

  lastPruneAt = now;

  try {
    await pruneExpiredRefreshTokens();
  } catch (error) {
    logger.error('Prune refresh tokens error:', error);
  }
};



export const register = async (input:RegisterInput) => {
    const existingUser = await findUserByEmail(input.email);
    if (existingUser) {
        throw new Error('EMAIL_ALREADY_EXISTS')
    }

    const hashedPassword = await hashPassword(input.password);
    await  createUser({
        name : input.name,
        email : input.email,
        password : hashedPassword,
    });
}

export const login = async (input: LoginInput) => {
  const user = await findUserByEmail(input.email);

  if (!user) {
    throw new Error('INVALID_CREDENTIALS');
  }

  if (!user.is_active) {
    throw new Error('USER_INACTIVE');
  }

  const passwordValid = await comparePassword(
    input.password,
    user.password,
  );

  if (!passwordValid) {
    throw new Error('INVALID_CREDENTIALS');
  }

  const accessToken = generateAccessToken(user.id);

  const refreshToken = generateRefreshToken(user.id);

  const tokenHash = hashToken(refreshToken);

  await createRefreshToken({
    userId: user.id,
    tokenHash,
    expiresAt: getRefreshTokenExpiry(),
  });

  await pruneRefreshTokensIfNeeded();

  return {
    accessToken,
    refreshToken,

    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      email_verified_at: user.email_verified_at,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
    },
  };
};

export const getCurrentUser = async (userId: string) => {
  const user = await findUserById(userId);

  if (!user) {
    throw new Error('USER_NOT_FOUND');
  }

  if (!user.is_active) {
    throw new Error('USER_INACTIVE');
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    email_verified_at: user.email_verified_at,
    profile: user.profiles,
  };
};

export const refreshAccessToken = async (
  refreshToken: string,
) => {
  const tokenHash = hashToken(refreshToken);

  const storedToken = await findRefreshToken(tokenHash);

  if (!storedToken) {
    throw new Error('INVALID_REFRESH_TOKEN');
  }

  /**
   * Token sudah pernah digunakan.
   *
   * Ini dapat mengindikasikan refresh token dicuri
   * dan digunakan kembali setelah rotation.
   *
   * Sesuai OWASP best practice, langsung revoke SELURUH
   * refresh token milik user untuk membatasi dampak pencurian.
   */
  if (storedToken.revoked_at) {
    await revokeAllUserRefreshTokens(
      storedToken.user_id,
    );

    throw new Error('REFRESH_TOKEN_REUSED');
  }

  if (storedToken.expires_at < new Date()) {
    throw new Error('REFRESH_TOKEN_EXPIRED');
  }

  let payload;

  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw new Error('INVALID_REFRESH_TOKEN');
  }

  if (payload.id !== storedToken.user_id) {
    throw new Error('INVALID_REFRESH_TOKEN');
  }

  const newRefreshToken =
    generateRefreshToken(storedToken.user_id);

  const newRefreshTokenHash =
    hashToken(newRefreshToken);

  let newRefreshTokenRecord;

  try {
    newRefreshTokenRecord =
      await rotateRefreshToken({
        oldTokenId: storedToken.id,

        newToken: {
          userId: storedToken.user_id,
          tokenHash: newRefreshTokenHash,
          expiresAt: getRefreshTokenExpiry(),
        },
      });
  } catch (error) {
    /**
     * Token lama ternyata sudah dirotasi proses lain yang berjalan
     * bersamaan (race). Perlakukan seperti pemakaian ulang sesuai
     * OWASP: revoke seluruh refresh token user.
     */
    if (
      error instanceof Error &&
      error.message === 'REFRESH_TOKEN_REUSED'
    ) {
      await revokeAllUserRefreshTokens(
        storedToken.user_id,
      );

      throw new Error('REFRESH_TOKEN_REUSED');
    }

    throw error;
  }

  await pruneRefreshTokensIfNeeded();

  const accessToken = generateAccessToken(
    storedToken.user_id,
  );

  return {
    accessToken,
    refreshToken: newRefreshToken,
    refreshTokenId: newRefreshTokenRecord.id,
  };
};

export const logout = async (
  refreshToken: string,
) => {
  const tokenHash = hashToken(refreshToken);

  const storedToken = await findRefreshToken(tokenHash);

  if (!storedToken) {
    return;
  }

  if (!storedToken.revoked_at) {
    await revokeRefreshToken(storedToken.id);
  }
};