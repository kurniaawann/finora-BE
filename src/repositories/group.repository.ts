import { prisma } from '../config/database.js';
import { userRefSelect } from '../dtos/common.dto.js';
import type { Prisma } from '../generated/prisma/client.js';
import type {
  group_members_role,
  groups_type,
} from '../generated/prisma/enums.js';

export interface GroupFilters {
  search?: string;
  type?: groups_type;
  isArchived: boolean;
}

const memberSelect = {
  id: true,
  group_id: true,
  user_id: true,
  role: true,
  nickname: true,
  joined_at: true,
} satisfies Prisma.group_membersSelect;

const groupBasicSelect = {
  id: true,
  name: true,
  currency: true,
  avatar_url: true,
  is_archived: true,
} satisfies Prisma.groupsSelect;

const groupDetailSelect = {
  id: true,
  name: true,
  description: true,
  type: true,
  currency: true,
  avatar_url: true,
  invite_code: true,
  is_archived: true,
  users: { select: userRefSelect },
  group_members: {
    // Enum MySQL diurutkan sesuai definisinya: owner, admin, member.
    orderBy: [{ role: 'asc' }, { joined_at: 'asc' }],
    select: {
      user_id: true,
      role: true,
      nickname: true,
      joined_at: true,
      users: { select: userRefSelect },
    },
  },
} satisfies Prisma.groupsSelect;

/**
 * Keanggotaan user di grup. Dipakai lintas modul (expense, settlement,
 * event, invitation) untuk cek akses; bentuk hasilnya adalah kontrak.
 */
export const findGroupMember = (groupId: string, userId: string) =>
  prisma.group_members.findUnique({
    where: { group_id_user_id: { group_id: groupId, user_id: userId } },
    select: memberSelect,
  });

/** Saring `userIds` menjadi yang benar-benar anggota grup. */
export const findGroupMemberIds = async (groupId: string, userIds: string[]) => {
  const members = await prisma.group_members.findMany({
    where: { group_id: groupId, user_id: { in: userIds } },
    select: { user_id: true },
  });

  return members.map((member) => member.user_id);
};

export const findGroupBasic = (groupId: string) =>
  prisma.groups.findUnique({
    where: { id: groupId },
    select: groupBasicSelect,
  });

export const findGroupDetail = (groupId: string) =>
  prisma.groups.findUnique({
    where: { id: groupId },
    select: groupDetailSelect,
  });

export const findGroupsForUser = async (params: {
  userId: string;
  page: number;
  perPage: number;
  filters: GroupFilters;
}) => {
  const { search, type, isArchived } = params.filters;

  const where: Prisma.groupsWhereInput = {
    group_members: { some: { user_id: params.userId } },
    is_archived: isArchived,
    ...(type ? { type } : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search } },
            { description: { contains: search } },
          ],
        }
      : {}),
  };

  const [data, total] = await prisma.$transaction([
    prisma.groups.findMany({
      where,
      orderBy: [{ created_at: 'desc' }],
      skip: (params.page - 1) * params.perPage,
      take: params.perPage,
      select: {
        id: true,
        name: true,
        description: true,
        type: true,
        currency: true,
        avatar_url: true,
        is_archived: true,
        _count: { select: { group_members: true } },
        group_members: {
          where: { user_id: params.userId },
          select: { role: true },
        },
      },
    }),
    prisma.groups.count({ where }),
  ]);

  return { data, total };
};

export const findGroupByInviteCode = (inviteCode: string) =>
  prisma.groups.findUnique({
    where: { invite_code: inviteCode },
    select: {
      id: true,
      name: true,
      type: true,
      avatar_url: true,
      is_archived: true,
      _count: { select: { group_members: true } },
    },
  });

export const isInviteCodeTaken = async (inviteCode: string) =>
  (await prisma.groups.count({ where: { invite_code: inviteCode } })) > 0;

export const countGroupExpenses = (groupId: string) =>
  prisma.expenses.count({ where: { group_id: groupId } });

export const createGroupWithOwner = (data: {
  ownerId: string;
  name: string;
  description: string | null;
  type: groups_type;
  currency: string;
  inviteCode: string;
}) =>
  prisma.groups.create({
    data: {
      owner_id: data.ownerId,
      name: data.name,
      description: data.description,
      type: data.type,
      currency: data.currency,
      invite_code: data.inviteCode,
      group_members: {
        create: { user_id: data.ownerId, role: 'owner' },
      },
    },
    select: { id: true },
  });

export const updateGroup = (
  groupId: string,
  data: Prisma.groupsUpdateInput,
) =>
  prisma.groups.update({
    where: { id: groupId },
    data,
    select: { id: true },
  });

export const deleteGroup = (groupId: string) =>
  prisma.groups.delete({ where: { id: groupId } });

/**
 * Tambah anggota sekaligus menutup undangan pending untuk user tersebut
 * di grup yang sama, agar tidak ada undangan menggantung.
 */
export const addGroupMember = (data: {
  groupId: string;
  userId: string;
  email: string;
  role?: group_members_role;
  nickname?: string | null;
}) =>
  prisma.$transaction(async (tx) => {
    await tx.group_members.create({
      data: {
        group_id: data.groupId,
        user_id: data.userId,
        role: data.role ?? 'member',
        nickname: data.nickname ?? null,
      },
    });

    await tx.invitations.updateMany({
      where: {
        group_id: data.groupId,
        status: 'pending',
        OR: [{ invitee_id: data.userId }, { email: data.email }],
      },
      data: {
        status: 'accepted',
        invitee_id: data.userId,
        accepted_at: new Date(),
      },
    });
  });

export const updateGroupMember = (
  groupId: string,
  userId: string,
  data: { role?: group_members_role; nickname?: string | null },
) =>
  prisma.group_members.update({
    where: { group_id_user_id: { group_id: groupId, user_id: userId } },
    data,
  });

export const transferGroupOwnership = (
  groupId: string,
  fromUserId: string,
  toUserId: string,
) =>
  prisma.$transaction([
    prisma.group_members.update({
      where: {
        group_id_user_id: { group_id: groupId, user_id: toUserId },
      },
      data: { role: 'owner' },
    }),
    prisma.group_members.update({
      where: {
        group_id_user_id: { group_id: groupId, user_id: fromUserId },
      },
      data: { role: 'admin' },
    }),
    prisma.groups.update({
      where: { id: groupId },
      data: { owner_id: toUserId },
    }),
  ]);

/** Keluarkan anggota beserta keikutsertaannya di acara-acara grup ini. */
export const removeGroupMember = (groupId: string, userId: string) =>
  prisma.$transaction([
    prisma.event_members.deleteMany({
      where: { user_id: userId, events: { group_id: groupId } },
    }),
    prisma.group_members.delete({
      where: { group_id_user_id: { group_id: groupId, user_id: userId } },
    }),
  ]);
