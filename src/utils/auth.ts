import type { Request } from 'express';

export const getAuthenticatedUserId = (
  req: Request,
): string => {
  if (!req.user) {
    throw new Error('UNAUTHORIZED');
  }

  return req.user.id;
};