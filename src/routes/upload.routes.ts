import { Router } from 'express';
import type { NextFunction, Request, Response } from 'express';
import multer, { MulterError } from 'multer';

import { uploadImageController } from '../controllers/upload.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { uploadImage } from '../middlewares/upload.middleware.js';
import { logger } from '../config/logger.js';
import { fail } from '../utils/response.js';

const router = Router();

router.use(authMiddleware);

router.post(
  '/images',
  (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    uploadImage.single('image')(
      req,
      res,
      (error: unknown) => {
        if (!error) {
          return next();
        }

        if (
          error instanceof MulterError &&
          error.code === 'LIMIT_FILE_SIZE'
        ) {
          return fail(
            res,
            413,
            'Ukuran gambar maksimal 5MB',
          );
        }

        if (
          error instanceof MulterError &&
          error.code === 'LIMIT_UNEXPECTED_FILE'
        ) {
          return fail(
            res,
            422,
            'Hanya boleh satu file pada field "image"',
          );
        }

        if (
          error instanceof Error &&
          error.message === 'INVALID_IMAGE_TYPE'
        ) {
          return fail(
            res,
            422,
            'Tipe file tidak didukung (jpg, jpeg, png, webp, gif)',
          );
        }

        logger.error('Upload error:', error);

        return fail(
          res,
          400,
          'Gagal mengunggah gambar',
        );
      },
    );
  },
  uploadImageController,
);

export default router;