import { z } from 'zod';

const tokenSchema = z
  .string({ error: 'Token perangkat wajib diisi' })
  .trim()
  .min(20, 'Token perangkat tidak valid')
  .max(512, 'Token perangkat tidak valid');

export const registerDeviceSchema = z.object({
  token: tokenSchema,
  platform: z.enum(['android', 'ios', 'web'], {
    error: 'Platform harus android, ios, atau web',
  }),
});

export const removeDeviceSchema = z.object({
  token: tokenSchema,
});

export type RegisterDeviceInput = z.infer<typeof registerDeviceSchema>;
export type RemoveDeviceInput = z.infer<typeof removeDeviceSchema>;
