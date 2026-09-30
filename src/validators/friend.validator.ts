import { z } from 'zod';

export const FRIEND_REQUEST_STATUSES = [
  'pending',
  'accepted',
  'rejected',
  'cancelled',
] as const;

export const FRIEND_REQUEST_DIRECTIONS = ['received', 'sent'] as const;

export const sendFriendRequestSchema = z.object({
  receiver_id: z.uuid('ID pengguna tidak valid'),
  message: z
    .string()
    .trim()
    .max(500, 'Pesan maksimal 500 karakter')
    .transform((value) => (value === '' ? null : value))
    .nullable()
    .optional(),
});

export type SendFriendRequestInput = z.infer<typeof sendFriendRequestSchema>;
