import rateLimit from 'express-rate-limit';
import type { Request, Response } from 'express';

import { fail } from '../utils/response.js';

interface RateLimiterOptions {
  windowMs: number;
  limit: number;
}

const createRateLimiter = ({ windowMs, limit }: RateLimiterOptions) => {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_req: Request, res: Response) => {
      return fail(
        res,
        429,
        'Terlalu banyak permintaan, silakan coba lagi nanti',
      );
    },
  });
};

export const generalRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 100,
});

export const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 20,
});