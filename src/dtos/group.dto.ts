import {
  toFileUrl,
  toIso,
  toUserRef,
  type UserRefDTO,
  type UserRefSource,
} from './common.dto.js';

export interface GroupListItemDTO {
  id: string;
  name: string;
  description: string | null;
  type: string;
  currency: string;
  avatar_url: string | null;
  member_count: number;
  my_role: string | null;
  is_archived: boolean;
}

export interface GroupMemberDTO {
  user: UserRefDTO;
  role: string;
  nickname: string | null;
  joined_at: string;
}

export interface GroupDetailDTO extends GroupListItemDTO {
  owner: UserRefDTO;
  invite_code: string;
  members: GroupMemberDTO[];
}

export interface GroupJoinPreviewDTO {
  id: string;
  name: string;
  avatar_url: string | null;
  type: string;
  member_count: number;
  is_member: boolean;
}

type GroupBaseSource = {
  id: string;
  name: string;
  description: string | null;
  type: string;
  currency: string;
  avatar_url: string | null;
  is_archived: boolean;
};

export const toGroupListItemDTO = (
  group: GroupBaseSource & {
    _count: { group_members: number };
    group_members: { role: string }[];
  },
): GroupListItemDTO => ({
  id: group.id,
  name: group.name,
  description: group.description,
  type: group.type,
  currency: group.currency,
  avatar_url: toFileUrl(group.avatar_url),
  member_count: group._count.group_members,
  my_role: group.group_members[0]?.role ?? null,
  is_archived: group.is_archived,
});

export const toGroupDetailDTO = (
  group: GroupBaseSource & {
    invite_code: string;
    users: UserRefSource;
    group_members: {
      user_id: string;
      role: string;
      nickname: string | null;
      joined_at: Date;
      users: UserRefSource;
    }[];
  },
  viewerId: string,
): GroupDetailDTO => ({
  id: group.id,
  name: group.name,
  description: group.description,
  type: group.type,
  currency: group.currency,
  avatar_url: toFileUrl(group.avatar_url),
  member_count: group.group_members.length,
  my_role:
    group.group_members.find((member) => member.user_id === viewerId)
      ?.role ?? null,
  is_archived: group.is_archived,
  owner: toUserRef(group.users),
  invite_code: group.invite_code,
  members: group.group_members.map((member) => ({
    user: toUserRef(member.users),
    role: member.role,
    nickname: member.nickname,
    joined_at: toIso(member.joined_at),
  })),
});

export const toGroupJoinPreviewDTO = (preview: {
  id: string;
  name: string;
  type: string;
  avatar_url: string | null;
  _count: { group_members: number };
  is_member: boolean;
}): GroupJoinPreviewDTO => ({
  id: preview.id,
  name: preview.name,
  avatar_url: toFileUrl(preview.avatar_url),
  type: preview.type,
  member_count: preview._count.group_members,
  is_member: preview.is_member,
});
