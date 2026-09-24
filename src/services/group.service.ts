import {
  addGroupMember,
  createGroup,
  deleteGroup,
  findGroupByInviteCode,
  findGroupByIdForUser,
  findGroupMember,
  findGroupsByUser,
  findUserByGroupTarget,
  removeGroupMember,
  updateGroup,
  updateGroupMember,
} from '../repositories/group.repository.js';

import type { GroupFilters } from '../repositories/group.repository.js';

import type {
  AddGroupMemberInput,
  CreateGroupInput,
  JoinGroupInput,
  UpdateGroupInput,
  UpdateGroupMemberInput,
} from '../validators/group.validator.js';

const assertMember = async (
  groupId: string,
  userId: string,
) => {
  const member = await findGroupMember(groupId, userId);

  if (!member) {
    throw new Error('GROUP_ACCESS_DENIED');
  }

  return member;
};

const assertManager = async (
  groupId: string,
  userId: string,
) => {
  const member = await assertMember(groupId, userId);

  if (member.role !== 'owner' && member.role !== 'admin') {
    throw new Error('GROUP_ACCESS_DENIED');
  }

  return member;
};

const assertOwner = async (
  groupId: string,
  userId: string,
) => {
  const group = await findGroupByIdForUser(groupId, userId);

  if (!group) {
    throw new Error('GROUP_NOT_FOUND');
  }

  if (group.owner_id !== userId) {
    throw new Error('GROUP_ACCESS_DENIED');
  }

  return group;
};

export const create = async (
  userId: string,
  input: CreateGroupInput,
) => {
  return createGroup({
    ownerId: userId,
    name: input.name,
    description: input.description ?? null,
    type: input.type,
    avatarUrl: input.avatar_url ?? null,
    currency: input.currency,
  });
};

export const getAll = async (
  userId: string,
  page: number,
  perPage: number,
  filters: GroupFilters = {},
) => {
  return findGroupsByUser({
    userId,
    page,
    perPage,
    filters,
  });
};

export const getById = async (
  userId: string,
  groupId: string,
) => {
  const group = await findGroupByIdForUser(
    groupId,
    userId,
  );

  if (!group) {
    throw new Error('GROUP_NOT_FOUND');
  }

  return group;
};

export const update = async (
  userId: string,
  groupId: string,
  input: UpdateGroupInput,
) => {
  await assertManager(groupId, userId);

  const data: Record<string, unknown> = {};

  if (input.name !== undefined) {
    data.name = input.name;
  }

  if (input.description !== undefined) {
    data.description = input.description;
  }

  if (input.type !== undefined) {
    data.type = input.type;
  }

  if (input.avatar_url !== undefined) {
    data.avatar_url = input.avatar_url;
  }

  if (input.is_archived !== undefined) {
    data.is_archived = input.is_archived;
  }

  const updated = await updateGroup(groupId, data);

  const group = await findGroupByIdForUser(groupId, userId);

  return group ?? updated;
};

export const remove = async (
  userId: string,
  groupId: string,
) => {
  const group = await assertOwner(userId, groupId);

  await deleteGroup(group.id);

  return true;
};

export const addMember = async (
  userId: string,
  groupId: string,
  input: AddGroupMemberInput,
) => {
  await assertManager(groupId, userId);

  const target = await findUserByGroupTarget(
    input.user_id,
  );

  if (!target) {
    throw new Error('USER_NOT_FOUND');
  }

  const existing = await findGroupMember(
    groupId,
    input.user_id,
  );

  if (existing) {
    throw new Error('ALREADY_MEMBER');
  }

  return addGroupMember({
    groupId,
    userId: input.user_id,
    role: 'member',
    nickname: input.nickname ?? null,
  });
};

export const updateMember = async (
  userId: string,
  groupId: string,
  targetUserId: string,
  input: UpdateGroupMemberInput,
) => {
  const member = await assertManager(groupId, userId);
  const target = await findGroupMember(
    groupId,
    targetUserId,
  );

  if (!target) {
    throw new Error('GROUP_MEMBER_NOT_FOUND');
  }

  if (target.role === 'owner') {
    throw new Error('OWNER_ROLE_LOCKED');
  }

  if (
    input.role === 'owner' &&
    member.role !== 'owner'
  ) {
    throw new Error('GROUP_ACCESS_DENIED');
  }

  const data: Record<string, unknown> = {};

  if (input.role !== undefined) {
    data.role = input.role;
  }

  if (input.nickname !== undefined) {
    data.nickname = input.nickname;
  }

  return updateGroupMember(groupId, targetUserId, data);
};

export const removeMember = async (
  userId: string,
  groupId: string,
  targetUserId: string,
) => {
  const target = await findGroupMember(
    groupId,
    targetUserId,
  );

  if (!target) {
    throw new Error('GROUP_MEMBER_NOT_FOUND');
  }

  if (target.role === 'owner') {
    throw new Error('OWNER_ROLE_LOCKED');
  }

  if (targetUserId !== userId) {
    await assertManager(groupId, userId);
  }

  const result = await removeGroupMember(
    groupId,
    targetUserId,
  );

  if (result.count === 0) {
    throw new Error('GROUP_MEMBER_NOT_FOUND');
  }

  return true;
};

export const joinByInviteCode = async (
  userId: string,
  input: JoinGroupInput,
) => {
  const group = await findGroupByInviteCode(
    input.invite_code,
  );

  if (!group) {
    throw new Error('INVITE_CODE_NOT_FOUND');
  }

  const existing = await findGroupMember(
    group.id,
    userId,
  );

  if (existing) {
    throw new Error('ALREADY_MEMBER');
  }

  return addGroupMember({
    groupId: group.id,
    userId,
    role: 'member',
  });
};