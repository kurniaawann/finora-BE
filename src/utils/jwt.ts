import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '../config/env.js';

export interface AccessTokenPayload {
  sub: string;
  type: 'access';
}

export const generateAccessToken = (userId: string): string => {
  const payload: AccessTokenPayload = {
    sub: userId,
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
    typeof decoded.sub !== 'string' ||
    decoded.type !== 'access'
  ) {
    throw new Error('INVALID_ACCESS_TOKEN');
  }

  return {
    sub: decoded.sub,
    type: 'access',
  };
};