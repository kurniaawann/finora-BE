import type { Request, Response } from 'express';

import { getHome } from '../services/home.service.js';
import { getAuthenticatedUserId } from '../utils/auth.js';
import { success } from '../utils/response.js';

export const getHomeController = async (req: Request, res: Response) => {
  const month =
    typeof req.query.month === 'string' && req.query.month.trim()
      ? req.query.month.trim()
      : undefined;

  const home = await getHome(getAuthenticatedUserId(req), month);

  return success(res, 200, 'Data beranda berhasil diambil', { data: home });
};
