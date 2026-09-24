import { z } from 'zod';

export const groupTypeSchema = z.enum([
  'personal',
  'club',
  'trip',
  'household',
  'project',
  'event',
  'other',
]);

export const groupMemberRoleSchema = z.enum([
  'owner',
  'admin',
  'member',
]);

export const createGroupSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Nama grup wajib diisi')
    .max(150, 'Nama grup maksimal 150 karakter'),

  description: z
    .string()
    .trim()
    .max(500, 'Deskripsi grup maksimal 500 karakter')
    .nullable()
    .optional(),

  type: groupTypeSchema.default('other'),

  avatar_url: z
    .string()
    .trim()
    .max(500, 'URL avatar maksimal 500 karakter')
    .nullable()
    .optional(),

  currency: z
    .string()
    .trim()
    .length(3, 'Currency harus terdiri dari 3 karakter')
    .toUpperCase()
    .default('IDR'),
});

export const updateGroupSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Nama grup wajib diisi')
    .max(150, 'Nama grup maksimal 150 karakter')
    .optional(),

  description: z
    .string()
    .trim()
    .max(500, 'Deskripsi grup maksimal 500 karakter')
    .nullable()
    .optional(),

  type: groupTypeSchema.optional(),

  avatar_url: z
    .string()
    .trim()
    .max(500, 'URL avatar maksimal 500 karakter')
    .nullable()
    .optional(),

  is_archived: z.boolean().optional(),
});

export const joinGroupSchema = z.object({
  invite_code: z
    .string()
    .trim()
    .min(1, 'Kode undangan wajib diisi')
    .max(50, 'Kode undangan maksimal 50 karakter'),
});

export const addGroupMemberSchema = z.object({
  user_id: z.string().uuid('ID pengguna tidak valid'),

  nickname: z
    .string()
    .trim()
    .max(255, 'Panggilan maksimal 255 karakter')
    .optional(),
});

export const updateGroupMemberSchema = z.object({
  role: groupMemberRoleSchema.optional(),

  nickname: z
    .string()
    .trim()
    .max(255, 'Panggilan maksimal 255 karakter')
    .nullable()
    .optional(),
});

export type CreateGroupInput = z.infer<
  typeof createGroupSchema
>;

export type UpdateGroupInput = z.infer<
  typeof updateGroupSchema
>;

export type JoinGroupInput = z.infer<
  typeof joinGroupSchema
>;

export type AddGroupMemberInput = z.infer<
  typeof addGroupMemberSchema
>;

export type UpdateGroupMemberInput = z.infer<
  typeof updateGroupMemberSchema
>;