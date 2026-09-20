import type { NextFunction, Request, Response } from 'express';

import { env } from '../config/env.js';
import { fail } from '../utils/response.js';

const matchOrigin = (value?: string): boolean => {
  if (!value) {
    return true;
  }

  try {
    return (
      new URL(value).origin ===
      new URL(env.frontendUrl).origin
    );
  } catch {
    return false;
  }
};

/**
 * Proteksi CSRF untuk endpoint yang mengandalkan cookie (refresh/logout).
 *
 * Browser mengirim header Origin/Referer pada request lintas-origin,
 * sedangkan client non-browser biasanya tidak mengirim keduanya
 * sehingga tetap dizinkan selama tidak ada header yang mencurigakan.
 */
export const originCheck = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const source =
    req.headers.origin ?? req.headers.referer;

  if (!matchOrigin(source)) {
    return fail(
      res,
      403,
      'Asal permintaan tidak dikenali',
    );
  }

  next();
};