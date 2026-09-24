import crypto from 'node:crypto';

import { prisma } from '../config/database.js';
import type { Prisma } from '../generated/prisma/client.js';
import type {
  group_members_role,
  groups_type,
} from '../generated/prisma/enums.js';

export interface GroupFilters {
  search?: string;
  type?: groups_type;
  isArchived?: boolean;
}

export interface CreateGroupData {
  ownerId: string;
  name: string;
  description?: string | null;
  type: groups_type;
  avatarUrl?: string | null;
  currency: string;
}

const userRefSelect = {
  id: true,
  name: true,
  profiles: {
    select: {
      username: true,
      full_name: true,
      avatar_url: true,
    },
  },
} satisfies Prisma.UserSelect;

const membersInclude = {
  users: {
    select: userRefSelect,
  },
} satisfies Prisma.group_membersInclude;

const summaryInclude = {
  users: {
    select: userRefSelect,
  },
  _count: {
    select: {
      group_members: true,
    },
  },
} satisfies Prisma.groupsInclude;

export const generateGroupInviteCode = (): string =>
  crypto.randomBytes(6).toString('hex').toUpperCase();

export const createGroup = async (
  data: CreateGroupData,
) => {
  return prisma.$transaction(async (tx) => {
    const group = await tx.groups.create({
      data: {
        users: {
          connect: {
            id: data.ownerId,
          },
        },
        name: data.name,
        description: data.description ?? null,
        type: data.type,
        avatar_url: data.avatarUrl ?? null,
        currency: data.currency,
        invite_code: generateGroupInviteCode(),
      },
    });

    await tx.group_members.create({
      data: {
        group_id: group.id,
        user_id: data.ownerId,
        role: 'owner',
      },
    });

    return tx.groups.findUnique({
      where: { id: group.id },
      include: summaryInclude,
    });
  });
};

export const findGroupsByUser = async (params: {
  userId: string;
  page: number;
  perPage: number;
  filters?: GroupFilters;
}) => {
  const skip = (params.page - 1) * params.perPage;
  const filters = params.filters ?? {};

  const conditions: Prisma.groupsWhereInput[] = [
    {
      group_members: {
        some: {
          user_id: params.userId,
        },
      },
    },
  ];

  if (filters.search) {
    conditions.push({
      OR: [
        { name: { contains: filters.search } },
        { description: { contains: filters.search } },
      ],
    });
  }

  if (filters.type) {
    conditions.push({ type: filters.type });
  }

  if (filters.isArchived !== undefined) {
    conditions.push({ is_archived: filters.isArchived });
  }

  const where: Prisma.groupsWhereInput = {
    AND: conditions,
  };

  const [data, total] = await prisma.$transaction([
    prisma.groups.findMany({
      where,
      orderBy: [{ created_at: 'desc' }],
      skip,
      take: params.perPage,
      include: summaryInclude,
    }),

    prisma.groups.count({ where }),
  ]);

  return { data, total };
};

export const findGroupByIdForUser = async (
  groupId: string,
  userId: string,
) => {
  return prisma.groups.findFirst({
    where: {
      id: groupId,
      group_members: {
        some: {
          user_id: userId,
        },
      },
    },
    include: {
      users: {
        select: userRefSelect,
      },
      group_members: {
        orderBy: [{ joined_at: 'asc' }],
        include: membersInclude,
      },
      _count: {
        select: {
          group_members: true,
        },
      },
    },
  });
};

export const findGroupById = async (groupId: string) => {
  return prisma.groups.findUnique({
    where: { id: groupId },
    include: {
      users: {
        select: userRefSelect,
      },
      group_members: {
        orderBy: [{ joined_at: 'asc' }],
        include: membersInclude,
      },
      _count: {
        select: {
          group_members: true,
        },
      },
    },
  });
};

export const findGroupByInviteCode = async (
  inviteCode: string,
) => {
  return prisma.groups.findFirst({
    where: {
      invite_code: inviteCode,
      is_archived: false,
    },
    include: summaryInclude,
  });
};

export const findGroupMember = async (
  groupId: string,
  userId: string,
) => {
  return prisma.group_members.findUnique({
    where: {
      group_id_user_id: {
        group_id: groupId,
        user_id: userId,
      },
    },
  });
};

export const findUserByGroupTarget = async (
  userId: string,
) => {
  return prisma.user.findFirst({
    where: {
      id: userId,
      is_active: true,
    },
  });
};

export const updateGroup = async (
  groupId: string,
  data: Prisma.groupsUpdateInput,
) => {
  return prisma.groups.update({
    where: { id: groupId },
    data,
    include: summaryInclude,
  });
};

export const deleteGroup = async (groupId: string) => {
  return prisma.groups.delete({
    where: { id: groupId },
  });
};

export const addGroupMember = async (data: {
  groupId: string;
  userId: string;
  role: group_members_role;
  nickname?: string | null;
}) => {
  return prisma.group_members.create({
    data: {
      group_id: data.groupId,
      user_id: data.userId,
      role: data.role,
      nickname: data.nickname ?? null,
    },
  });
};

export const updateGroupMember = async (
  groupId: string,
  userId: string,
  data: {
    role?: group_members_role;
    nickname?: string | null;
  },
) => {
  return prisma.group_members.update({
    where: {
      group_id_user_id: {
        group_id: groupId,
        user_id: userId,
      },
    },
    data,
  });
};

export const removeGroupMember = async (
  groupId: string,
  userId: string,
) => {
  return prisma.group_members.deleteMany({
    where: {
      group_id: groupId,
      user_id: userId,
    },
  });
};