import { z } from 'zod';

export const INVITATION_STATUSES = [
  'pending',
  'accepted',
  'rejected',
  'expired',
  'cancelled',
] as const;

export const INVITATION_DIRECTIONS = ['received', 'sent'] as const;

export const createInvitationSchema = z
  .object({
    invitee_id: z.uuid('ID pengguna tidak valid').optional(),
    email: z
      .string()
      .trim()
      .max(255, 'Email maksimal 255 karakter')
      .pipe(z.email('Format email tidak valid'))
      .transform((value) => value.toLowerCase())
      .optional(),
  })
  .refine((data) => Boolean(data.invitee_id) !== Boolean(data.email), {
    message: 'Isi salah satu: invitee_id (akun Finora) atau email',
    path: ['invitee_id'],
  });

export type CreateInvitationInput = z.infer<typeof createInvitationSchema>;
