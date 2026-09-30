import { z } from 'zod';

const emailSchema = z
  .string({ error: 'Email wajib diisi' })
  .trim()
  .max(255, 'Email maksimal 255 karakter')
  .pipe(z.email('Format email tidak valid'))
  .transform((value) => value.toLowerCase());

const newPasswordSchema = z
  .string({ error: 'Password wajib diisi' })
  .min(8, 'Password minimal 8 karakter')
  .max(72, 'Password maksimal 72 karakter');

export const registerSchema = z.object({
  name: z
    .string({ error: 'Nama wajib diisi' })
    .trim()
    .min(2, 'Nama minimal 2 karakter')
    .max(100, 'Nama maksimal 100 karakter'),
  email: emailSchema,
  password: newPasswordSchema,
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z
    .string({ error: 'Password wajib diisi' })
    .min(1, 'Password wajib diisi')
    .max(72, 'Password maksimal 72 karakter'),
});

export const refreshTokenSchema = z.object({
  refresh_token: z
    .string({ error: 'Refresh token wajib diisi' })
    .min(1, 'Refresh token wajib diisi'),
});

export const changePasswordSchema = z
  .object({
    current_password: z
      .string({ error: 'Password lama wajib diisi' })
      .min(1, 'Password lama wajib diisi'),
    new_password: newPasswordSchema,
  })
  .refine(
    (data) => data.current_password !== data.new_password,
    {
      path: ['new_password'],
      message: 'Password baru harus berbeda dari password lama',
    },
  );

export const deleteAccountSchema = z.object({
  password: z
    .string({ error: 'Password wajib diisi' })
    .min(1, 'Password wajib diisi'),
});

const otpSchema = z
  .string({ error: 'Kode wajib diisi' })
  .trim()
  .regex(/^\d{6}$/, 'Kode harus 6 digit angka');

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z.object({
  email: emailSchema,
  code: otpSchema,
  new_password: newPasswordSchema,
});

export const verifyEmailSchema = z.object({
  code: otpSchema,
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type DeleteAccountInput = z.infer<typeof deleteAccountSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
