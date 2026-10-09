import crypto from 'node:crypto';
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

interface SignedToken {
  token: string;
  expiresAt: Date;
  /** Umur token dalam detik. */
  expiresIn: number;
}

const sign = (
  payload: object,
  secret: string,
  expiresIn: string,
): SignedToken => {
  const token = jwt.sign(payload, secret, {
    expiresIn: expiresIn as SignOptions['expiresIn'],
  });

  const decoded = jwt.decode(token) as { iat: number; exp: number };

  return {
    token,
    expiresAt: new Date(decoded.exp * 1000),
    expiresIn: decoded.exp - decoded.iat,
  };
};

const verify = (
  token: string,
  secret: string,
  type: 'access' | 'refresh',
): { id: string } => {
  const decoded = jwt.verify(token, secret);

  if (
    typeof decoded !== 'object' ||
    decoded === null ||
    typeof decoded.id !== 'string' ||
    decoded.type !== type
  ) {
    throw new Error(`INVALID_${type.toUpperCase()}_TOKEN`);
  }

  return { id: decoded.id };
};

export const generateAccessToken = (userId: string): SignedToken =>
  sign(
    { id: userId, type: 'access' } satisfies AccessTokenPayload,
    env.jwtAccessSecret,
    env.jwtAccessExpiresIn,
  );

export const verifyAccessToken = (token: string): AccessTokenPayload => ({
  ...verify(token, env.jwtAccessSecret, 'access'),
  type: 'access',
});

/**
 * `jti` unik agar dua token yang dibuat di detik yang sama tidak identik
 * dan tidak bentrok pada constraint token_hash.
 */
export const generateRefreshToken = (userId: string): SignedToken =>
  sign(
    {
      id: userId,
      type: 'refresh',
      jti: crypto.randomUUID(),
    },
    env.jwtRefreshSecret,
    env.jwtRefreshExpiresIn,
  );

export const verifyRefreshToken = (token: string): RefreshTokenPayload => ({
  ...verify(token, env.jwtRefreshSecret, 'refresh'),
  type: 'refresh',
});
