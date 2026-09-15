import type { Request, Response } from 'express';

import { register } from '../services/auth.service.js';
import { registerSchema } from '../validators/auth.validator.js';

export const registerController = async (
  req: Request,
  res: Response,
) => {
  const validation = registerSchema.safeParse(req.body);

  if (!validation.success) {
    return res.status(422).json({
      success: false,
      message: 'Data yang dikirim tidak valid',
      errors: validation.error.flatten().fieldErrors,
    });
  }

  try {
    const user = await register(validation.data);

    return res.status(201).json({
      success: true,
      message: 'Registrasi berhasil',
      data: {
        user,
      },
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === 'EMAIL_ALREADY_EXISTS'
    ) {
      return res.status(409).json({
        success: false,
        message: 'Email sudah terdaftar',
      });
    }

    console.error(error);

    return res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan pada server',
    });
  }
};