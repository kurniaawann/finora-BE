import { z } from 'zod';

const nullableText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label} maksimal ${max} karakter`)
    .transform((value) => (value === '' ? null : value))
    .nullable()
    .optional();

export const updateProfileSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Nama minimal 2 karakter')
    .max(100, 'Nama maksimal 100 karakter')
    .optional(),

  username: z
    .string()
    .trim()
    .min(3, 'Username minimal 3 karakter')
    .max(50, 'Username maksimal 50 karakter')
    .regex(
      /^[a-zA-Z0-9_.]+$/,
      'Username hanya boleh huruf, angka, titik, atau garis bawah',
    )
    .transform((value) => value.toLowerCase())
    .nullable()
    .optional(),

  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9 -]{6,20}$/, 'Nomor telepon tidak valid')
    .nullable()
    .optional(),

  bio: nullableText(500, 'Bio'),

  currency: z
    .string()
    .trim()
    .length(3, 'Kode mata uang harus 3 huruf')
    .toUpperCase()
    .optional(),

  timezone: z
    .string()
    .trim()
    .max(50, 'Timezone maksimal 50 karakter')
    .refine((value) => {
      try {
        new Intl.DateTimeFormat('en-US', { timeZone: value });
        return true;
      } catch {
        return false;
      }
    }, 'Timezone tidak valid, contoh: Asia/Jakarta')
    .optional(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
