import type { NextFunction, Request, Response } from 'express';

import { verifyAccessToken } from '../utils/jwt.js';

export const authMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const authorization = req.headers.authorization;

  if (!authorization) {
    return res.status(401).json({
      success: false,
      message: 'Token autentikasi diperlukan',
    });
  }

  const [scheme, token] = authorization.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({
      success: false,
      message: 'Format token tidak valid',
    });
  }

  try {
    const payload = verifyAccessToken(token);

    req.user = {
      id: payload.sub,
    };

    next();
  } catch {
    return res.status(401).json({
      success: false,
      message: 'Token tidak valid atau sudah kedaluwarsa',
    });
  }
};