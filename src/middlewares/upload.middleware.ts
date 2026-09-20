import path from 'node:path';
import multer from 'multer';

import {
  MAX_IMAGE_SIZE_MB,
  uploadDir,
} from '../config/upload.js';

const ALLOWED_EXTENSIONS = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.gif',
]);

const storage = multer.diskStorage({
  destination: (
    _req,
    _file,
    callback,
  ) => {
    callback(null, uploadDir);
  },

  filename: (
    _req,
    file,
    callback,
  ) => {
    const extension = path
      .extname(file.originalname)
      .toLowerCase();

    const randomName =
      crypto.randomUUID().replaceAll('-', '');

    callback(null, `${randomName}${extension}`);
  },
});

const fileFilter: multer.Options['fileFilter'] = (
  _req,
  file,
  callback,
) => {
  const extension = path
    .extname(file.originalname)
    .toLowerCase();

  if (!ALLOWED_EXTENSIONS.has(extension)) {
    return callback(
      new Error('INVALID_IMAGE_TYPE'),
    );
  }

  if (!file.mimetype.startsWith('image/')) {
    return callback(
      new Error('INVALID_IMAGE_TYPE'),
    );
  }

  return callback(null, true);
};

export const uploadImage = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_IMAGE_SIZE_MB * 1024 * 1024,
    files: 1,
  },
});