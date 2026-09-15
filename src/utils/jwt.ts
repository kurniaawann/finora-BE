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