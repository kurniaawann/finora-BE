import { z } from 'zod';

export const sendFriendRequestSchema = z.object({
  receiver_id: z
    .string()
    .uuid('ID penerima tidak valid'),

  message: z
    .string()
    .trim()
    .max(500, 'Pesan maksimal 500 karakter')
    .optional(),
});

export const respondFriendRequestSchema = z.object({
  action: z.enum(['accept', 'reject']),
});

export type SendFriendRequestInput = z.infer<
  typeof sendFriendRequestSchema
>;

export type RespondFriendRequestInput = z.infer<
  typeof respondFriendRequestSchema
>;