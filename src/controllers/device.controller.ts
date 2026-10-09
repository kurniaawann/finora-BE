import type { Request, Response } from 'express';

import {
  deleteDeviceToken,
  upsertDeviceToken,
} from '../repositories/device-token.repository.js';
import { getAuthenticatedUserId } from '../utils/auth.js';
import { success } from '../utils/response.js';
import type {
  RegisterDeviceInput,
  RemoveDeviceInput,
} from '../validators/device.validator.js';

/**
 * Aplikasi memanggil ini setiap login/buka aplikasi dan saat FCM
 * memberi token baru (onTokenRefresh).
 */
export const registerDeviceController = async (
  req: Request,
  res: Response,
) => {
  const input = req.body as RegisterDeviceInput;

  await upsertDeviceToken({
    userId: getAuthenticatedUserId(req),
    token: input.token,
    platform: input.platform,
  });

  return success(res, 200, 'Perangkat berhasil didaftarkan');
};

/** Dipanggil sebelum logout agar perangkat tidak menerima push lagi. */
export const removeDeviceController = async (req: Request, res: Response) => {
  const input = req.body as RemoveDeviceInput;

  await deleteDeviceToken(getAuthenticatedUserId(req), input.token);

  return success(res, 200, 'Perangkat berhasil dihapus');
};
