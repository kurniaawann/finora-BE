import type { Prisma } from '../generated/prisma/client.js';
import {
  findProfileByUsername,
  findUserById,
  updateUserAndProfile,
} from '../repositories/user.repository.js';
import { conflict, notFound } from '../utils/app-error.js';
import type { UpdateProfileInput } from '../validators/profile.validator.js';
import { deleteImage, saveImage } from './storage.service.js';

const requireUser = async (userId: string) => {
  const user = await findUserById(userId);

  if (!user) {
    throw notFound('USER_NOT_FOUND', 'User tidak ditemukan');
  }

  return user;
};

export const getProfile = requireUser;

export const updateProfile = async (
  userId: string,
  input: UpdateProfileInput,
) => {
  await requireUser(userId);

  if (input.username) {
    const existing = await findProfileByUsername(input.username);

    if (existing && existing.user_id !== userId) {
      throw conflict(
        'USERNAME_TAKEN',
        'Username sudah dipakai pengguna lain',
      );
    }
  }

  const { name, ...profileFields } = input;
  const profile: Prisma.ProfileUpdateInput = {};

  for (const [key, value] of Object.entries(profileFields)) {
    if (value !== undefined) {
      (profile as Record<string, unknown>)[key] = value;
    }
  }

  return updateUserAndProfile(userId, {
    user: name !== undefined ? { name } : undefined,
    profile: Object.keys(profile).length > 0 ? profile : undefined,
  });
};

export const updateAvatar = async (
  userId: string,
  file: Express.Multer.File | undefined,
) => {
  const user = await requireUser(userId);
  const avatarPath = await saveImage(file, 'avatars');

  const updated = await updateUserAndProfile(userId, {
    profile: { avatar_url: avatarPath },
  });

  await deleteImage(user.profiles?.avatar_url);

  return updated;
};

export const removeAvatar = async (userId: string) => {
  const user = await requireUser(userId);

  const updated = await updateUserAndProfile(userId, {
    profile: { avatar_url: null },
  });

  await deleteImage(user.profiles?.avatar_url);

  return updated;
};
