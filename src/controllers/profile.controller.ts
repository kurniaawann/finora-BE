import type { Request, Response } from 'express';

import { toMeDTO } from '../dtos/user.dto.js';
import {
  getProfile,
  removeAvatar,
  updateAvatar,
  updateProfile,
} from '../services/profile.service.js';
import { getAuthenticatedUserId } from '../utils/auth.js';
import { success } from '../utils/response.js';

export const getProfileController = async (req: Request, res: Response) => {
  const user = await getProfile(getAuthenticatedUserId(req));

  return success(res, 200, 'Profil berhasil diambil', {
    data: toMeDTO(user),
  });
};

export const updateProfileController = async (
  req: Request,
  res: Response,
) => {
  const user = await updateProfile(getAuthenticatedUserId(req), req.body);

  return success(res, 200, 'Profil berhasil diperbarui', {
    data: toMeDTO(user),
  });
};

export const updateAvatarController = async (
  req: Request,
  res: Response,
) => {
  const user = await updateAvatar(getAuthenticatedUserId(req), req.file);

  return success(res, 200, 'Foto profil berhasil diperbarui', {
    data: toMeDTO(user),
  });
};

export const removeAvatarController = async (
  req: Request,
  res: Response,
) => {
  const user = await removeAvatar(getAuthenticatedUserId(req));

  return success(res, 200, 'Foto profil berhasil dihapus', {
    data: toMeDTO(user),
  });
};
