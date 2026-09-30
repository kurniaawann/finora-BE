import crypto from 'node:crypto';

import { prisma } from '../config/database.js';
import { groupRefSelect, userRefSelect } from '../dtos/common.dto.js';
import type { Prisma } from '../generated/prisma/client.js';
import type { invitations_status } from '../generated/prisma/enums.js';

const invitationSelect = {
  id: true,
  group_id: true,
  inviter_id: true,
  invitee_id: true,
  email: true,
  status: true,
  expires_at: true,
  created_at: true,
  groups: {
    select: {
      ...groupRefSelect,
      is_archived: true,
      _count: { select: { group_members: true } },
    },
  },
  users_invitations_inviter_idTousers: { select: userRefSelect },
  users_invitations_invitee_idTousers: { select: userRefSelect },
} satisfies Prisma.invitationsSelect;

/** Tandai undangan pending yang sudah lewat masa berlakunya. */
export const expireOutdatedInvitations = (
  scope: Prisma.invitationsWhereInput,
) =>
  prisma.invitations.updateMany({
    where: {
      AND: [scope, { status: 'pending', expires_at: { lt: new Date() } }],
    },
    data: { status: 'expired' },
  });

export const findPendingInvitation = (params: {
  groupId: string;
  inviteeId: string | null;
  email: string | null;
}) =>
  prisma.invitations.findFirst({
    where: {
      group_id: params.groupId,
      status: 'pending',
      OR: [
        ...(params.inviteeId ? [{ invitee_id: params.inviteeId }] : []),
        ...(params.email ? [{ email: params.email }] : []),
      ],
    },
    select: { id: true },
  });

export const createInvitation = (data: {
  groupId: string;
  inviterId: string;
  inviteeId: string | null;
  email: string | null;
  expiresAt: Date;
}) =>
  prisma.invitations.create({
    data: {
      group_id: data.groupId,
      inviter_id: data.inviterId,
      invitee_id: data.inviteeId,
      email: data.email,
      // Kolom wajib di DB; tidak dipakai lagi oleh API.
      token: crypto.randomBytes(32).toString('hex'),
      expires_at: data.expiresAt,
    },
    select: invitationSelect,
  });

export const findInvitationById = (invitationId: string) =>
  prisma.invitations.findUnique({
    where: { id: invitationId },
    select: invitationSelect,
  });

export const findInvitations = async (params: {
  where: Prisma.invitationsWhereInput;
  status?: invitations_status;
  page: number;
  perPage: number;
}) => {
  const where: Prisma.invitationsWhereInput = {
    AND: [params.where, params.status ? { status: params.status } : {}],
  };

  const [data, total] = await prisma.$transaction([
    prisma.invitations.findMany({
      where,
      orderBy: [{ created_at: 'desc' }],
      skip: (params.page - 1) * params.perPage,
      take: params.perPage,
      select: invitationSelect,
    }),
    prisma.invitations.count({ where }),
  ]);

  return { data, total };
};

/**
 * Terima undangan dan jadikan anggota secara atomik. Mengembalikan
 * false bila undangan sudah tidak pending (diproses request lain).
 */
export const acceptInvitation = (
  invitationId: string,
  groupId: string,
  userId: string,
) =>
  prisma.$transaction(async (tx) => {
    const { count } = await tx.invitations.updateMany({
      where: { id: invitationId, status: 'pending' },
      data: {
        status: 'accepted',
        invitee_id: userId,
        accepted_at: new Date(),
      },
    });

    if (count === 0) {
      return false;
    }

    await tx.group_members.upsert({
      where: { group_id_user_id: { group_id: groupId, user_id: userId } },
      create: { group_id: groupId, user_id: userId, role: 'member' },
      update: {},
    });

    return true;
  });

/** Ubah status undangan pending; false bila sudah tidak pending. */
export const closeInvitation = async (
  invitationId: string,
  data: {
    status: 'rejected' | 'cancelled' | 'expired';
    inviteeId?: string;
  },
) => {
  const { count } = await prisma.invitations.updateMany({
    where: { id: invitationId, status: 'pending' },
    data: {
      status: data.status,
      ...(data.inviteeId ? { invitee_id: data.inviteeId } : {}),
    },
  });

  return count > 0;
};
