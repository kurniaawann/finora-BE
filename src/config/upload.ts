import fs from 'node:fs';
import path from 'node:path';

import { env } from './env.js';

// Path relatif di-resolve dari root project (cwd saat server dijalankan).
export const uploadDir = path.resolve(env.uploadDir);

export const uploadUrlPrefix = '/uploads';

export const MAX_IMAGE_SIZE_MB = 10;

// Foto dikompres ke WebP dengan sisi terpanjang maksimal nilai ini.
export const IMAGE_MAX_DIMENSION = 1600;
export const AVATAR_MAX_DIMENSION = 512;

export const IMAGE_FOLDERS = [
  'avatars',
  'groups',
  'receipts',
  'proofs',
] as const;

export type ImageFolder = (typeof IMAGE_FOLDERS)[number];

export const ensureUploadDir = () => {
  for (const folder of IMAGE_FOLDERS) {
    fs.mkdirSync(path.join(uploadDir, folder), {
      recursive: true,
    });
  }
};
