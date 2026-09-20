import type { Request, Response } from 'express';

import { uploadUrlPrefix } from '../config/upload.js';
import { logger } from '../config/logger.js';
import { fail, success } from '../utils/response.js';

export const uploadImageController = async (
  req: Request,
  res: Response,
) => {
  try {
    const file = req.file;

    if (!file) {
      return fail(
        res,
        422,
        'Gambar wajib diunggah pada field "image"',
      );
    }

    const url = `${uploadUrlPrefix}/${file.filename}`;

    return success(
      res,
      201,
      'Gambar berhasil diunggah',
      {
        data: {
          url,
          original_name: file.originalname,
          size_bytes: file.size,
          mime_type: file.mimetype,
        },
      },
    );
  } catch (error) {
    logger.error(error);

    return fail(
      res,
      500,
      'Gagal mengunggah gambar',
    );
  }
};