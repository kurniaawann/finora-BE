export interface GroupUserRefDTO {
  id: string;
  name: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
}

export interface GroupSummaryDTO {
  id: string;
  name: string;
  description: string | null;
  type: string;
  avatar_url: string | null;
  currency: string;
  invite_code: string;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
  member_count: number;
}

export interface GroupMemberDTO {
  user: GroupUserRefDTO;
  role: string;
  nickname: string | null;
  joined_at: string;
}

export interface GroupDetailDTO extends GroupSummaryDTO {
  owner: GroupUserRefDTO;
  members: GroupMemberDTO[];
}

type UserLike = {
  id: string;
  name: string;
  profiles?: {
    username?: string | null;
    full_name?: string | null;
    avatar_url?: string | null;
  } | null;
};

type GroupLike = {
  id: string;
  name: string;
  description?: string | null;
  type: string;
  avatar_url?: string | null;
  currency: string;
  invite_code: string;
  is_archived: boolean;
  created_at: Date | string;
  updated_at: Date | string;
  users: UserLike;
  group_members?: {
    role: string;
    nickname?: string | null;
    joined_at: Date | string;
    users: UserLike;
  }[];
  _count?: { group_members: number };
};

export const toUserRef = (
  user: UserLike,
): GroupUserRefDTO => ({
  id: user.id,
  name: user.name,
  username: user.profiles?.username ?? null,
  full_name: user.profiles?.full_name ?? null,
  avatar_url: user.profiles?.avatar_url ?? null,
});

const toIso = (value: Date | string): string =>
  new Date(value).toISOString();

export const toGroupSummaryDTO = (
  group: GroupLike,
): GroupSummaryDTO => ({
  id: group.id,
  name: group.name,
  description: group.description ?? null,
  type: group.type,
  avatar_url: group.avatar_url ?? null,
  currency: group.currency,
  invite_code: group.invite_code,
  is_archived: group.is_archived,
  created_at: toIso(group.created_at),
  updated_at: toIso(group.updated_at),
  member_count: group._count?.group_members ?? 0,
});

export const toGroupDetailDTO = (
  group: GroupLike,
): GroupDetailDTO => ({
  ...toGroupSummaryDTO(group),
  owner: toUserRef(group.users),
  members: (group.group_members ?? []).map(
    (member) => ({
      user: toUserRef(member.users),
      role: member.role,
      nickname: member.nickname ?? null,
      joined_at: toIso(member.joined_at),
    }),
  ),
});