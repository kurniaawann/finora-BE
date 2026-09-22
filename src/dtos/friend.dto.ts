export interface FriendUserRefDTO {
  id: string;
  name: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
}

export interface SearchUserDTO extends FriendUserRefDTO {
  request_status: string | null;
}

export const toSearchUserDTO = (
  user: SearchUserLike,
): SearchUserDTO => ({
  ...toUserRef(user),
  request_status: user.request_status ?? null,
});

export interface FriendRequestDTO {
  id: string;
  status: string;
  message: string | null;
  responded_at: string | null;
  created_at: string;
  user: FriendUserRefDTO;
}

export interface FriendDTO {
  id: string;
  name: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
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

type SearchUserLike = UserLike & {
  request_status?: string | null;
};

const toUserRef = (user: UserLike): FriendUserRefDTO => ({
  id: user.id,
  name: user.name,
  username: user.profiles?.username ?? null,
  full_name: user.profiles?.full_name ?? null,
  avatar_url: user.profiles?.avatar_url ?? null,
});

const toIso = (value: Date | string | null): string | null =>
  value ? new Date(value).toISOString() : null;

type RequestLike = {
  id: string;
  sender_id: string;
  receiver_id: string;
  status: string;
  message: string | null;
  responded_at: Date | string | null;
  created_at: Date | string;
  users_friend_requests_sender_idTousers: UserLike;
  users_friend_requests_receiver_idTousers: UserLike;
};

export const toFriendRequestDTO = (
  request: RequestLike,
  userId: string,
): FriendRequestDTO => ({
  id: request.id,
  status: request.status,
  message: request.message ?? null,
  responded_at: toIso(request.responded_at),
  created_at: new Date(
    request.created_at,
  ).toISOString(),
  user: toUserRef(
    request.sender_id === userId
      ? request.users_friend_requests_receiver_idTousers
      : request.users_friend_requests_sender_idTousers,
  ),
});

type FriendshipLike = {
  id: string;
  created_at: Date | string;
  user_a_id: string;
  users_friendships_user_a_idTousers: UserLike;
  users_friendships_user_b_idTousers: UserLike;
};

export const toFriendDTO = (
  friendship: FriendshipLike,
  userId: string,
): FriendDTO => {
  const isUserA =
    friendship.user_a_id === userId;

  const friend = toUserRef(
    isUserA
      ? friendship.users_friendships_user_b_idTousers
      : friendship.users_friendships_user_a_idTousers,
  );

  return {
    ...friend,
    created_at: new Date(
      friendship.created_at,
    ).toISOString(),
  };
};