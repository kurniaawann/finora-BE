import { createRefreshToken, findRefreshToken, revokeRefreshTokenByHash } from '../repositories/refresh-token.js';
import {
  createUser,
  findUserByEmail,
  findUserByEmailGetProfile,
  findUserById,
} from '../repositories/user.repository.js';
import { getRefreshTokenExpiry } from '../utils/date.js';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../utils/jwt.js';

import { comparePassword, hashPassword } from '../utils/password.js';
import { hashToken } from '../utils/token.js';
import type { LoginInput, RegisterInput } from '../validators/auth.validator.js';



export const register = async (input:RegisterInput) => {
    const existingUser = await findUserByEmail(input.email);
    if (existingUser) {
        throw new Error('EMAIL_ALREADY_EXISTS')
    }

    const hashedPassword = await hashPassword(input.password);
    const user = await  createUser({
        name : input.name,
        email : input.email,
        password : hashedPassword,
    });

    return {
        id: user.id,
        name: user.name,
        email: user.email,
        profile: user.profiles,
        createdAt: user.created_at
    }
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

  return {
    accessToken,
    refreshToken,

    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      emailVerifiedAt: user.email_verified_at,
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
    emailVerifiedAt: user.email_verified_at,
    profile: user.profiles,
    createdAt: user.created_at,
    updatedAt: user.updated_at,
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

  if (storedToken.revoked_at) {
    throw new Error('INVALID_REFRESH_TOKEN');
  }

  if (storedToken.expires_at < new Date()) {
    throw new Error('REFRESH_TOKEN_EXPIRED');
  }

  const payload = verifyRefreshToken(refreshToken);

  if (payload.sub !== storedToken.user_id) {
    throw new Error('INVALID_REFRESH_TOKEN');
  }

  const accessToken = generateAccessToken(
    storedToken.user_id,
  );

  return {
    accessToken,
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
    await revokeRefreshTokenByHash(tokenHash);
  }
};