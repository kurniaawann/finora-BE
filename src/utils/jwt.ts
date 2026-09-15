import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '../config/env.js';

export interface AccessTokenPayload {
  id: string;
  type: 'access';
}

export interface RefreshTokenPayload {
  id: string;
  type: 'refresh';
}

export const generateAccessToken = (userId: string): string => {
  const payload: AccessTokenPayload = {
    id: userId,
    type: 'access',
  };

  const options: SignOptions = {
    expiresIn: env.jwtAccessExpiresIn as SignOptions['expiresIn'],
  };

  return jwt.sign(payload, env.jwtAccessSecret, options);
};

export const verifyAccessToken = (
  token: string,
): AccessTokenPayload => {
  const decoded = jwt.verify(
    token,
    env.jwtAccessSecret,
  );

  if (
    typeof decoded !== 'object' ||
    decoded === null ||
    typeof decoded.id !== 'string' ||
    decoded.type !== 'access'
  ) {
    throw new Error('INVALID_ACCESS_TOKEN');
  }

  return {
    id: decoded.id,
    type: 'access',
  };
};

export const generateRefreshToken = (
  userId: string,
): string => {
  const payload: RefreshTokenPayload = {
    id: userId,
    type: 'refresh',
  };

  return jwt.sign(payload, env.jwtRefreshSecret, {
    expiresIn: env.jwtRefreshExpiresIn as SignOptions['expiresIn'],
  });
};

export const verifyRefreshToken = (
  token: string,
): RefreshTokenPayload => {
  const decoded = jwt.verify(
    token,
    env.jwtRefreshSecret,
  );

  if (
    typeof decoded !== 'object' ||
    decoded === null ||
    typeof decoded.id !== 'string' ||
    decoded.type !== 'refresh'
  ) {
    throw new Error('INVALID_REFRESH_TOKEN');
  }

  return {
    id: decoded.id,
    type: 'refresh',
  };
};