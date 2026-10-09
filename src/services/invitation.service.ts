import type { invitations_status } from '../generated/prisma/enums.js';
import { findGroupMember } from '../repositories/group.repository.js';
import {
  acceptInvitation as acceptPendingInvitation,
  closeInvitation,
  createInvitation as insertInvitation,
  expireOutdatedInvitations,
  findInvitationById,
  findInvitations,
  findPendingInvitation,
} from '../repositories/invitation.repository.js';
import {
  findUserByEmail,
  findUserById,
} from '../repositories/user.repository.js';
import type { AuthenticatedUser } from '../types/auth.js';
import {
  conflict,
  forbidden,
  notFound,
  unprocessable,
} from '../utils/app-error.js';
import type { PaginationParams } from '../utils/pagination.js';
import type { CreateInvitationInput } from '../validators/invitation.validator.js';
import {
  assertGroupNotArchived,
  isGroupManager,
  requireGroupManager,
} from './group.service.js';
import { notify } from './notifier.service.js';

const INVITATION_TTL_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

const CLOSED_STATUS_MESSAGES: Record<string, string> = {
  accepted: 'Undangan sudah diterima',
  rejected: 'Undangan sudah ditolak',
  cancelled: 'Undangan sudah dibatalkan',
};

type Invitation = NonNullable<Awaited<ReturnType<typeof findInvitationById>>>;

const notPending = (status = '') =>
  conflict(
    'INVITATION_NOT_PENDING',
    CLOSED_STATUS_MESSAGES[status] ?? 'Undangan sudah tidak berlaku',
  );

const requireInvitation = async (invitationId: string) => {
  const invitation = await findInvitationById(invitationId);

  if (!invitation) {
    throw notFound('INVITATION_NOT_FOUND', 'Undangan tidak ditemukan');
  }

  return invitation;
};

/**
 * Undangan lewat email hanya berlaku bagi pemilik email yang sudah
 * terverifikasi, agar orang lain tidak bisa mendaftar memakai email
 * korban lalu menerima undangannya.
 */
const isRecipient = (invitation: Invitation, user: AuthenticatedUser) =>
  invitation.invitee_id === user.id ||
  (user.emailVerified &&
    invitation.email !== null &&
    invitation.email.toLowerCase() === user.email.toLowerCase());

const isGroupManagerOf = async (groupId: string, userId: string) => {
  const member = await findGroupMember(groupId, userId);

  return member !== null && isGroupManager(member.role);
};

/** Undangan pending yang sudah lewat expires_at dianggap expired. */
const refreshExpiry = async (invitation: Invitation): Promise<Invitation> => {
  if (
    invitation.status === 'pending' &&
    invitation.expires_at &&
    invitation.expires_at.getTime() < Date.now()
  ) {
    await closeInvitation(invitation.id, { status: 'expired' });

    return { ...invitation, status: 'expired' };
  }

  return invitation;
};

const assertPending = (invitation: Invitation) => {
  if (invitation.status === 'expired') {
    throw conflict('INVITATION_EXPIRED', 'Undangan sudah kedaluwarsa');
  }

  if (invitation.status !== 'pending') {
    throw notPending(invitation.status);
  }
};

const requirePendingForRecipient = async (
  user: AuthenticatedUser,
  invitationId: string,
) => {
  const invitation = await requireInvitation(invitationId);

  if (!isRecipient(invitation, user)) {
    throw forbidden('INVITATION_FORBIDDEN', 'Undangan ini bukan untukmu');
  }

  const current = await refreshExpiry(invitation);

  assertPending(current);

  return current;
};

export const createInvitation = async (
  userId: string,
  groupId: string,
  input: CreateInvitationInput,
) => {
  const { group } = await requireGroupManager(groupId, userId);

  assertGroupNotArchived(group);

  const email = input.email ?? null;
  let invitee = null;
  // Akun pemilik email (terverifikasi atau belum), untuk cek duplikat.
  let emailAccountId: string | null = null;

  if (input.invitee_id) {
    invitee = await findUserById(input.invitee_id);
  } else if (email) {
    // Akun dengan email belum terverifikasi diperlakukan seperti belum
    // terdaftar; undangan tetap tersimpan per email sampai terverifikasi.
    const registered = await findUserByEmail(email);
    invitee = registered?.email_verified_at ? registered : null;
    emailAccountId = registered?.is_active ? registered.id : null;
  }

  if ((input.invitee_id && !invitee) || (invitee && !invitee.is_active)) {
    throw notFound('USER_NOT_FOUND', 'Pengguna tidak ditemukan');
  }

  if (invitee?.id === userId) {
    throw unprocessable(
      'CANNOT_INVITE_SELF',
      'Kamu tidak bisa mengundang diri sendiri',
    );
  }

  const targetAccountId = invitee?.id ?? emailAccountId;

  if (targetAccountId && (await findGroupMember(groupId, targetAccountId))) {
    throw conflict(
      'ALREADY_MEMBER',
      'Pengguna sudah menjadi anggota grup ini',
    );
  }

  await expireOutdatedInvitations({ group_id: groupId });

  const duplicate = await findPendingInvitation({
    groupId,
    inviteeId: targetAccountId,
    email: invitee?.email ?? email,
  });

  if (duplicate) {
    throw conflict(
      'INVITE_ALREADY_SENT',
      'Undangan untuk pengguna ini sudah terkirim dan masih menunggu jawaban',
    );
  }

  const invitation = await insertInvitation({
    groupId,
    inviterId: userId,
    inviteeId: invitee?.id ?? null,
    email,
    expiresAt: new Date(Date.now() + INVITATION_TTL_DAYS * DAY_MS),
  });

  if (invitee) {
    await notify({
      userIds: invitee.id,
      type: 'invitation',
      title: 'Undangan grup',
      message: `${invitation.users_invitations_inviter_idTousers.name} mengundangmu bergabung ke grup ${invitation.groups.name}`,
      data: { invitation_id: invitation.id, group_id: groupId },
      excludeUserId: userId,
    });
  }

  return invitation;
};

export const listGroupInvitations = async (
  userId: string,
  groupId: string,
  pagination: PaginationParams,
  status: invitations_status | undefined,
) => {
  await requireGroupManager(groupId, userId);
  await expireOutdatedInvitations({ group_id: groupId });

  return findInvitations({ where: { group_id: groupId }, status, ...pagination });
};

export const listMyInvitations = async (
  user: AuthenticatedUser,
  pagination: PaginationParams,
  filters: {
    direction: 'received' | 'sent';
    status?: invitations_status;
  },
) => {
  const where =
    filters.direction === 'sent'
      ? { inviter_id: user.id }
      : user.emailVerified
        ? { OR: [{ invitee_id: user.id }, { email: user.email }] }
        : { invitee_id: user.id };

  await expireOutdatedInvitations(where);

  return findInvitations({ where, status: filters.status, ...pagination });
};

export const getInvitation = async (
  user: AuthenticatedUser,
  invitationId: string,
) => {
  const invitation = await requireInvitation(invitationId);
  const canManage =
    invitation.inviter_id === user.id ||
    (await isGroupManagerOf(invitation.group_id, user.id));

  if (!canManage && !isRecipient(invitation, user)) {
    throw forbidden(
      'INVITATION_FORBIDDEN',
      'Kamu tidak berhak melihat undangan ini',
    );
  }

  return {
    invitation: await refreshExpiry(invitation),
    includeEmail: canManage,
  };
};

export const acceptInvitation = async (
  user: AuthenticatedUser,
  invitationId: string,
) => {
  const invitation = await requirePendingForRecipient(user, invitationId);

  assertGroupNotArchived(invitation.groups);

  if (
    !(await acceptPendingInvitation(
      invitation.id,
      invitation.group_id,
      user.id,
    ))
  ) {
    throw notPending();
  }

  const accepted = await requireInvitation(invitation.id);

  await notify({
    userIds: accepted.inviter_id,
    type: 'invitation',
    title: 'Undangan diterima',
    message: `${accepted.users_invitations_invitee_idTousers?.name ?? 'Seseorang'} menerima undanganmu dan bergabung ke grup ${accepted.groups.name}`,
    data: { invitation_id: accepted.id, group_id: accepted.group_id },
    excludeUserId: user.id,
  });

  return accepted;
};

export const rejectInvitation = async (
  user: AuthenticatedUser,
  invitationId: string,
) => {
  const invitation = await requirePendingForRecipient(user, invitationId);

  if (
    !(await closeInvitation(invitation.id, {
      status: 'rejected',
      inviteeId: user.id,
    }))
  ) {
    throw notPending();
  }

  const rejected = await requireInvitation(invitation.id);

  await notify({
    userIds: rejected.inviter_id,
    type: 'invitation',
    title: 'Undangan ditolak',
    message: `${rejected.users_invitations_invitee_idTousers?.name ?? 'Seseorang'} menolak undangan bergabung ke grup ${rejected.groups.name}`,
    data: { invitation_id: rejected.id, group_id: rejected.group_id },
    excludeUserId: user.id,
  });

  return rejected;
};

export const cancelInvitation = async (
  userId: string,
  invitationId: string,
) => {
  const invitation = await requireInvitation(invitationId);

  if (
    invitation.inviter_id !== userId &&
    !(await isGroupManagerOf(invitation.group_id, userId))
  ) {
    throw forbidden(
      'INVITATION_FORBIDDEN',
      'Hanya pengirim atau pengelola grup yang bisa membatalkan undangan ini',
    );
  }

  assertPending(await refreshExpiry(invitation));

  if (!(await closeInvitation(invitation.id, { status: 'cancelled' }))) {
    throw notPending();
  }

  return requireInvitation(invitation.id);
};
