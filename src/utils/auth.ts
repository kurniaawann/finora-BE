import type { Request } from 'express';

import type { AuthenticatedUser } from '../types/auth.js';
import { unauthorized } from './app-error.js';

export const getAuthUser = (req: Request): AuthenticatedUser => {
  if (!req.user) {
    throw unauthorized(
      'UNAUTHENTICATED',
      'Autentikasi diperlukan',
    );
  }

  return req.user;
};

export const getAuthenticatedUserId = (req: Request): string =>
  getAuthUser(req).id;

/** Ambil route param sebagai string (Express 5 bisa mengetik string | string[]). */
export const getParam = (req: Request, key: string): string => {
  const value = req.params[key];

  return Array.isArray(value) ? value[0] : (value ?? '');
};
