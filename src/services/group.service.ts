import crypto from 'node:crypto';

import { areFriends } from '../repositories/friend.repository.js';
import {
  addGroupMember,
  countGroupExpenses,
  createGroupWithOwner,
  deleteGroup as removeGroup,
  findGroupBasic,
  findGroupByInviteCode,
  findGroupDetail,
  findGroupMember,
  findGroupsForUser,
  isInviteCodeTaken,
  removeGroupMember,
  transferGroupOwnership,
  updateGroup as saveGroup,
  updateGroupMember,
  type GroupFilters,
} from '../repositories/group.repository.js';
import { findUserById } from '../repositories/user.repository.js';
import type { Prisma } from '../generated/prisma/client.js';
import type { AuthenticatedUser } from '../types/auth.js';
import {
  conflict,
  forbidden,
  notFound,
  unprocessable,
} from '../utils/app-error.js';
import type { PaginationParams } from '../utils/pagination.js';
import type {
  AddGroupMemberInput,
  CreateGroupInput,
  TransferOwnershipInput,
  UpdateGroupInput,
  UpdateGroupMemberInput,
} from '../validators/group.validator.js';
import { getGroupBalances, getMemberNetBalance } from './balance.service.js';
import { notify } from './notifier.service.js';
import { deleteImage, saveImage } from './storage.service.js';

// 32 karakter tanpa yang mirip (0/O, 1/I) agar mudah diketik ulang.
const INVITE_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const INVITE_CODE_LENGTH = 8;
const INVITE_CODE_MAX_ATTEMPTS = 5;

const groupNotFound = () =>
  notFound('GROUP_NOT_FOUND', 'Grup tidak ditemukan');

const groupAccessDenied = () =>
  forbidden('GROUP_ACCESS_DENIED', 'Kamu bukan anggota grup ini');

export const isGroupManager = (role: string) =>
  role === 'owner' || role === 'admin';

/** Grup harus ada (404) dan user harus anggotanya (403). */
export const requireGroupMember = async (groupId: string, userId: string) => {
  const [group, member] = await Promise.all([
    findGroupBasic(groupId),
    findGroupMember(groupId, userId),
  ]);

  if (!group) {
    throw groupNotFound();
  }

  if (!member) {
    throw groupAccessDenied();
  }

  return { group, member };
};

export const requireGroupManager = async (
  groupId: string,
  userId: string,
) => {
  const access = await requireGroupMember(groupId, userId);

  if (!isGroupManager(access.member.role)) {
    throw forbidden(
      'GROUP_MANAGER_REQUIRED',
      'Hanya owner atau admin grup yang bisa melakukan aksi ini',
    );
  }

  return access;
};

const requireGroupOwner = async (groupId: string, userId: string) => {
  const access = await requireGroupMember(groupId, userId);

  if (access.member.role !== 'owner') {
    throw forbidden(
      'GROUP_OWNER_REQUIRED',
      'Hanya owner grup yang bisa melakukan aksi ini',
    );
  }

  return access;
};

export const assertGroupNotArchived = (group: { is_archived: boolean }) => {
  if (group.is_archived) {
    throw conflict(
      'GROUP_ARCHIVED',
      'Grup sudah diarsipkan dan tidak menerima anggota baru',
    );
  }
};

const requireTargetMember = async (groupId: string, userId: string) => {
  const member = await findGroupMember(groupId, userId);

  if (!member) {
    throw notFound('GROUP_MEMBER_NOT_FOUND', 'Anggota grup tidak ditemukan');
  }

  return member;
};

const loadGroupDetail = async (groupId: string) => {
  const group = await findGroupDetail(groupId);

  if (!group) {
    throw groupNotFound();
  }

  return group;
};

type GroupDetail = Awaited<ReturnType<typeof loadGroupDetail>>;

const memberName = (group: GroupDetail, userId: string) =>
  group.group_members.find((member) => member.user_id === userId)?.users
    .name ?? 'Seseorang';

const assertMemberSettled = async (
  groupId: string,
  userId: string,
  message: string,
) => {
  if ((await getMemberNetBalance(groupId, userId)) !== 0) {
    throw conflict('MEMBER_HAS_OUTSTANDING_BALANCE', message);
  }
};

const generateInviteCode = () =>
  Array.from(
    crypto.randomBytes(INVITE_CODE_LENGTH),
    (byte) => INVITE_CODE_ALPHABET[byte % INVITE_CODE_ALPHABET.length],
  ).join('');

const generateUniqueInviteCode = async () => {
  for (let attempt = 0; attempt < INVITE_CODE_MAX_ATTEMPTS; attempt += 1) {
    const code = generateInviteCode();

    if (!(await isInviteCodeTaken(code))) {
      return code;
    }
  }

  throw new Error('Gagal membuat kode undangan grup yang unik');
};

const requireGroupByInviteCode = async (inviteCode: string) => {
  const group = await findGroupByInviteCode(inviteCode.trim().toUpperCase());

  if (!group) {
    throw notFound(
      'INVITE_CODE_NOT_FOUND',
      'Kode undangan tidak ditemukan atau sudah tidak berlaku',
    );
  }

  return group;
};

export const listGroups = (
  userId: string,
  pagination: PaginationParams,
  filters: GroupFilters,
) => findGroupsForUser({ userId, ...pagination, filters });

export const getGroup = async (userId: string, groupId: string) => {
  const group = await loadGroupDetail(groupId);

  if (!group.group_members.some((member) => member.user_id === userId)) {
    throw groupAccessDenied();
  }

  return group;
};

export const createGroup = async (userId: string, input: CreateGroupInput) => {
  const group = await createGroupWithOwner({
    ownerId: userId,
    name: input.name,
    description: input.description ?? null,
    type: input.type,
    currency: input.currency,
    inviteCode: await generateUniqueInviteCode(),
  });

  return loadGroupDetail(group.id);
};

export const updateGroup = async (
  userId: string,
  groupId: string,
  input: UpdateGroupInput,
) => {
  const { group } = await requireGroupManager(groupId, userId);
  const { currency, ...fields } = input;
  const data: Prisma.groupsUpdateInput = {};

  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined) {
      (data as Record<string, unknown>)[key] = value;
    }
  }

  if (currency !== undefined && currency !== group.currency) {
    if ((await countGroupExpenses(groupId)) > 0) {
      throw conflict(
        'GROUP_CURRENCY_LOCKED',
        'Mata uang tidak bisa diubah karena grup sudah memiliki pengeluaran',
      );
    }

    data.currency = currency;
  }

  if (Object.keys(data).length > 0) {
    await saveGroup(groupId, data);
  }

  return loadGroupDetail(groupId);
};

export const updateGroupAvatar = async (
  userId: string,
  groupId: string,
  file: Express.Multer.File | undefined,
) => {
  const { group } = await requireGroupManager(groupId, userId);
  const avatarPath = await saveImage(file, 'groups');

  await saveGroup(groupId, { avatar_url: avatarPath });
  await deleteImage(group.avatar_url);

  return loadGroupDetail(groupId);
};

export const removeGroupAvatar = async (userId: string, groupId: string) => {
  const { group } = await requireGroupManager(groupId, userId);

  await saveGroup(groupId, { avatar_url: null });
  await deleteImage(group.avatar_url);

  return loadGroupDetail(groupId);
};

export const deleteGroup = async (userId: string, groupId: string) => {
  const { group } = await requireGroupOwner(groupId, userId);
  const balances = await getGroupBalances(groupId, userId);

  if (balances.members.some((member) => Number(member.net_balance) !== 0)) {
    throw conflict(
      'GROUP_HAS_OUTSTANDING_BALANCE',
      'Grup tidak bisa dihapus karena masih ada utang-piutang yang belum lunas',
    );
  }

  await removeGroup(groupId);
  await deleteImage(group.avatar_url);
};

export const regenerateInviteCode = async (
  userId: string,
  groupId: string,
) => {
  await requireGroupManager(groupId, userId);
  await saveGroup(groupId, { invite_code: await generateUniqueInviteCode() });

  return loadGroupDetail(groupId);
};

export const previewGroupByInviteCode = async (
  userId: string,
  inviteCode: string,
) => {
  const group = await requireGroupByInviteCode(inviteCode);
  const isMember = (await findGroupMember(group.id, userId)) !== null;

  if (!isMember) {
    assertGroupNotArchived(group);
  }

  return { ...group, is_member: isMember };
};

export const joinGroupByInviteCode = async (
  user: AuthenticatedUser,
  inviteCode: string,
) => {
  const group = await requireGroupByInviteCode(inviteCode);

  if (await findGroupMember(group.id, user.id)) {
    throw conflict('ALREADY_MEMBER', 'Kamu sudah menjadi anggota grup ini');
  }

  assertGroupNotArchived(group);

  await addGroupMember({
    groupId: group.id,
    userId: user.id,
    email: user.email,
  });

  const detail = await loadGroupDetail(group.id);

  await notify({
    userIds: detail.group_members
      .filter((member) => isGroupManager(member.role))
      .map((member) => member.user_id),
    type: 'invitation',
    title: 'Anggota baru',
    message: `${memberName(detail, user.id)} bergabung ke grup ${detail.name} lewat kode undangan`,
    data: { group_id: group.id },
    excludeUserId: user.id,
  });

  return detail;
};

export const addMember = async (
  userId: string,
  groupId: string,
  input: AddGroupMemberInput,
) => {
  const { group } = await requireGroupManager(groupId, userId);

  assertGroupNotArchived(group);

  const target = await findUserById(input.user_id);

  if (!target || !target.is_active) {
    throw notFound('USER_NOT_FOUND', 'Pengguna tidak ditemukan');
  }

  if (await findGroupMember(groupId, target.id)) {
    throw conflict(
      'ALREADY_MEMBER',
      'Pengguna sudah menjadi anggota grup ini',
    );
  }

  // Tambah langsung hanya untuk teman; selain itu lewat undangan.
  if (!(await areFriends(userId, target.id))) {
    throw forbidden(
      'FRIENDSHIP_REQUIRED',
      'Hanya teman yang bisa ditambahkan langsung. Kirim undangan untuk mengajak pengguna lain',
    );
  }

  await addGroupMember({
    groupId,
    userId: target.id,
    email: target.email,
    nickname: input.nickname ?? null,
  });

  const detail = await loadGroupDetail(groupId);

  await notify({
    userIds: target.id,
    type: 'invitation',
    title: 'Ditambahkan ke grup',
    message: `${memberName(detail, userId)} menambahkan kamu ke grup ${detail.name}`,
    data: { group_id: groupId },
    excludeUserId: userId,
  });

  return detail;
};

export const updateMember = async (
  userId: string,
  groupId: string,
  targetUserId: string,
  input: UpdateGroupMemberInput,
) => {
  const { member: actor } = await requireGroupMember(groupId, userId);
  const target = await requireTargetMember(groupId, targetUserId);

  if (input.role !== undefined) {
    if (actor.role !== 'owner') {
      throw forbidden(
        'GROUP_OWNER_REQUIRED',
        'Hanya owner grup yang bisa mengubah role anggota',
      );
    }

    if (target.role === 'owner') {
      throw conflict(
        'OWNER_ROLE_LOCKED',
        'Role owner hanya bisa dipindahkan lewat transfer kepemilikan',
      );
    }
  }

  if (
    input.nickname !== undefined &&
    targetUserId !== userId &&
    !isGroupManager(actor.role)
  ) {
    throw forbidden(
      'GROUP_MANAGER_REQUIRED',
      'Hanya owner atau admin yang bisa mengubah nama panggilan anggota lain',
    );
  }

  await updateGroupMember(groupId, targetUserId, {
    role: input.role,
    nickname: input.nickname,
  });

  return loadGroupDetail(groupId);
};

export const transferOwnership = async (
  userId: string,
  groupId: string,
  input: TransferOwnershipInput,
) => {
  await requireGroupOwner(groupId, userId);

  if (input.user_id === userId) {
    throw unprocessable(
      'INVALID_OWNERSHIP_TARGET',
      'Pilih anggota lain sebagai owner baru',
    );
  }

  await requireTargetMember(groupId, input.user_id);
  await transferGroupOwnership(groupId, userId, input.user_id);

  const detail = await loadGroupDetail(groupId);

  await notify({
    userIds: input.user_id,
    type: 'invitation',
    title: 'Kamu owner grup sekarang',
    message: `${memberName(detail, userId)} menjadikan kamu owner grup ${detail.name}`,
    data: { group_id: groupId },
    excludeUserId: userId,
  });

  return detail;
};

export const leaveGroup = async (userId: string, groupId: string) => {
  const { member } = await requireGroupMember(groupId, userId);

  if (member.role === 'owner') {
    throw conflict(
      'OWNER_MUST_TRANSFER',
      'Pindahkan kepemilikan grup ke anggota lain sebelum keluar, atau hapus grup',
    );
  }

  await assertMemberSettled(
    groupId,
    userId,
    'Kamu masih punya utang-piutang di grup ini. Selesaikan pelunasan terlebih dahulu',
  );

  await removeGroupMember(groupId, userId);
};

export const removeMember = async (
  userId: string,
  groupId: string,
  targetUserId: string,
) => {
  if (targetUserId === userId) {
    return leaveGroup(userId, groupId);
  }

  const { group, member: actor } = await requireGroupManager(groupId, userId);
  const target = await requireTargetMember(groupId, targetUserId);

  if (target.role === 'owner') {
    throw forbidden(
      'MEMBER_REMOVAL_FORBIDDEN',
      'Owner grup tidak bisa dikeluarkan',
    );
  }

  if (target.role === 'admin' && actor.role !== 'owner') {
    throw forbidden(
      'MEMBER_REMOVAL_FORBIDDEN',
      'Admin hanya bisa dikeluarkan oleh owner grup',
    );
  }

  await assertMemberSettled(
    groupId,
    targetUserId,
    'Anggota ini masih punya utang-piutang di grup. Selesaikan pelunasan terlebih dahulu',
  );

  await removeGroupMember(groupId, targetUserId);

  await notify({
    userIds: targetUserId,
    type: 'invitation',
    title: 'Dikeluarkan dari grup',
    message: `Kamu dikeluarkan dari grup ${group.name}`,
    data: { group_id: groupId },
    excludeUserId: userId,
  });
};

export const getBalances = async (userId: string, groupId: string) => {
  await requireGroupMember(groupId, userId);

  return getGroupBalances(groupId, userId);
};
