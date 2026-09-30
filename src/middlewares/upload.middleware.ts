import multer from 'multer';

import { MAX_IMAGE_SIZE_MB } from '../config/upload.js';
import { unprocessable } from '../utils/app-error.js';

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
]);

/**
 * File disimpan di memori dulu, lalu diproses (validasi isi, buang
 * metadata EXIF/GPS, kompres) oleh storage service sebelum ditulis.
 */
const uploader = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_IMAGE_SIZE_MB * 1024 * 1024,
    files: 1,
  },
  fileFilter: (_req, file, callback) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype.toLowerCase())) {
      return callback(
        unprocessable(
          'INVALID_IMAGE_TYPE',
          'Format foto harus JPG, PNG, WEBP, atau HEIC',
        ),
      );
    }

    return callback(null, true);
  },
});

/** Terima satu foto pada field multipart `photo`. */
export const uploadPhoto = uploader.single('photo');
