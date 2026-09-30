import { z } from 'zod';

export const GROUP_TYPES = [
  'personal',
  'club',
  'trip',
  'household',
  'project',
  'event',
  'other',
] as const;

const groupTypeSchema = z.enum(GROUP_TYPES, {
  error: 'Jenis grup tidak valid',
});

const nameSchema = z
  .string({ error: 'Nama grup wajib diisi' })
  .trim()
  .min(1, 'Nama grup wajib diisi')
  .max(150, 'Nama grup maksimal 150 karakter');

const descriptionSchema = z
  .string()
  .trim()
  .max(500, 'Deskripsi grup maksimal 500 karakter')
  .transform((value) => (value === '' ? null : value))
  .nullable()
  .optional();

const currencySchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z]{3}$/, 'Kode mata uang harus 3 huruf, mis. IDR')
  .toUpperCase();

const nicknameSchema = z
  .string()
  .trim()
  .max(100, 'Nama panggilan maksimal 100 karakter')
  .transform((value) => (value === '' ? null : value))
  .nullable()
  .optional();

const userIdSchema = z.uuid('ID pengguna tidak valid');

const hasAnyField = (data: Record<string, unknown>) =>
  Object.values(data).some((value) => value !== undefined);

export const createGroupSchema = z.object({
  name: nameSchema,
  description: descriptionSchema,
  type: groupTypeSchema.default('other'),
  currency: currencySchema.default('IDR'),
});

export const updateGroupSchema = z
  .object({
    name: nameSchema.optional(),
    description: descriptionSchema,
    type: groupTypeSchema.optional(),
    currency: currencySchema.optional(),
    is_archived: z
      .boolean({ error: 'is_archived harus boolean' })
      .optional(),
  })
  .refine(hasAnyField, { message: 'Tidak ada data yang diubah' });

export const joinGroupSchema = z.object({
  invite_code: z
    .string({ error: 'Kode undangan wajib diisi' })
    .trim()
    .min(1, 'Kode undangan wajib diisi')
    .max(50, 'Kode undangan tidak valid')
    .toUpperCase(),
});

export const addGroupMemberSchema = z.object({
  user_id: userIdSchema,
  nickname: nicknameSchema,
});

export const updateGroupMemberSchema = z
  .object({
    // Role owner hanya bisa dipindahkan lewat transfer kepemilikan.
    role: z
      .enum(['admin', 'member'], {
        error: 'Role harus admin atau member',
      })
      .optional(),
    nickname: nicknameSchema,
  })
  .refine(hasAnyField, { message: 'Tidak ada data yang diubah' });

export const transferOwnershipSchema = z.object({
  user_id: userIdSchema,
});

export type CreateGroupInput = z.infer<typeof createGroupSchema>;
export type UpdateGroupInput = z.infer<typeof updateGroupSchema>;
export type AddGroupMemberInput = z.infer<typeof addGroupMemberSchema>;
export type UpdateGroupMemberInput = z.infer<
  typeof updateGroupMemberSchema
>;
export type TransferOwnershipInput = z.infer<
  typeof transferOwnershipSchema
>;
