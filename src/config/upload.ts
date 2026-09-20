import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDir = path.dirname(fileURLToPath(import.meta.url));

// Arahkan ke <root>/src/public/images (compatible dev via tsx & prod via dist).
export const uploadDir = path.resolve(
  currentDir,
  '../../src/public/images',
);

export const uploadUrlPrefix = '/uploads/images';

export const MAX_IMAGE_SIZE_MB = 5;

export const ensureUploadDir = () => {
  fs.mkdirSync(uploadDir, {
    recursive: true,
  });
};