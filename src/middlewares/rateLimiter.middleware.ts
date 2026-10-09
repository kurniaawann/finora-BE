import rateLimit from 'express-rate-limit';
import type { Request, Response } from 'express';

import { fail } from '../utils/response.js';

interface RateLimiterOptions {
  windowMs: number;
  limit: number;
}

const createRateLimiter = ({ windowMs, limit }: RateLimiterOptions) =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_req: Request, res: Response) =>
      fail(res, 429, 'Terlalu banyak permintaan, coba lagi nanti', {
        code: 'TOO_MANY_REQUESTS',
      }),
  });

const FIFTEEN_MINUTES = 15 * 60 * 1000;

// Longgar karena banyak pengguna seluler berbagi IP (carrier NAT).
export const generalRateLimiter = createRateLimiter({
  windowMs: FIFTEEN_MINUTES,
  limit: 1000,
});

// Ketat untuk mencegah brute force password.
export const authRateLimiter = createRateLimiter({
  windowMs: FIFTEEN_MINUTES,
  limit: 20,
});

export const refreshRateLimiter = createRateLimiter({
  windowMs: FIFTEEN_MINUTES,
  limit: 60,
});
