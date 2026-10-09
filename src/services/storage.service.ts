import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

import sharp from 'sharp';

import { logger } from '../config/logger.js';
import {
  AVATAR_MAX_DIMENSION,
  IMAGE_MAX_DIMENSION,
  type ImageFolder,
  uploadDir,
} from '../config/upload.js';
import { unprocessable } from '../utils/app-error.js';

const requirePhoto = (
  file: Express.Multer.File | undefined,
): Express.Multer.File => {
  if (!file) {
    throw unprocessable(
      'PHOTO_REQUIRED',
      'Foto wajib diunggah pada field "photo"',
    );
  }

  return file;
};

/**
 * Simpan foto sebagai WebP terkompresi. Metadata (EXIF, lokasi GPS)
 * dibuang dan orientasi diperbaiki. Mengembalikan path relatif yang
 * disimpan di DB, mis. "proofs/9f1c...e2.webp".
 */
export const saveImage = async (
  file: Express.Multer.File | undefined,
  folder: ImageFolder,
): Promise<string> => {
  const photo = requirePhoto(file);
  const maxDimension = folder === 'avatars' || folder === 'groups'
    ? AVATAR_MAX_DIMENSION
    : IMAGE_MAX_DIMENSION;

  let output: Buffer;

  try {
    output = await sharp(photo.buffer, { failOn: 'error' })
      .rotate()
      .resize({
        width: maxDimension,
        height: maxDimension,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: 80 })
      .toBuffer();
  } catch {
    throw unprocessable(
      'INVALID_IMAGE',
      'File bukan foto yang valid atau formatnya tidak didukung',
    );
  }

  const fileName = `${crypto.randomBytes(16).toString('hex')}.webp`;
  const relativePath = `${folder}/${fileName}`;

  await fs.writeFile(path.join(uploadDir, relativePath), output);

  return relativePath;
};

/**
 * Hapus file lama saat foto diganti/dihapus. Gagal hapus tidak boleh
 * menggagalkan request, cukup dicatat.
 */
export const deleteImage = async (
  relativePath: string | null | undefined,
): Promise<void> => {
  if (!relativePath || /^https?:\/\//i.test(relativePath)) {
    return;
  }

  const target = path.resolve(uploadDir, relativePath);

  // Cegah path traversal keluar dari folder upload.
  if (!target.startsWith(`${uploadDir}${path.sep}`)) {
    return;
  }

  try {
    await fs.unlink(target);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      logger.warn(`Gagal menghapus file ${relativePath}`, error);
    }
  }
};
