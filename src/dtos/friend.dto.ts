import {
  toIso,
  toUserRef,
  type UserRefDTO,
  type UserRefSource,
} from './common.dto.js';

export type FriendshipStatus =
  | 'none'
  | 'friends'
  | 'request_sent'
  | 'request_received';

export interface UserSearchResultDTO extends UserRefDTO {
  friendship_status: FriendshipStatus;
  friend_request_id: string | null;
}

export interface FriendRequestDTO {
  id: string;
  status: string;
  message: string | null;
  created_at: string;
  direction: 'sent' | 'received';
  /** Pihak lain dari sudut pandang user yang login. */
  user: UserRefDTO;
}

export interface FriendDTO {
  user: UserRefDTO;
  friends_since: string;
}

export const toUserSearchResultDTO = (result: {
  user: UserRefSource;
  friendship_status: FriendshipStatus;
  friend_request_id: string | null;
}): UserSearchResultDTO => ({
  ...toUserRef(result.user),
  friendship_status: result.friendship_status,
  friend_request_id: result.friend_request_id,
});

export const toFriendRequestDTO = (
  request: {
    id: string;
    sender_id: string;
    status: string;
    message: string | null;
    created_at: Date;
    users_friend_requests_sender_idTousers: UserRefSource;
    users_friend_requests_receiver_idTousers: UserRefSource;
  },
  viewerId: string,
): FriendRequestDTO => {
  const isSender = request.sender_id === viewerId;

  return {
    id: request.id,
    status: request.status,
    message: request.message,
    created_at: toIso(request.created_at),
    direction: isSender ? 'sent' : 'received',
    user: toUserRef(
      isSender
        ? request.users_friend_requests_receiver_idTousers
        : request.users_friend_requests_sender_idTousers,
    ),
  };
};

export const toFriendDTO = (
  friendship: {
    user_a_id: string;
    created_at: Date;
    users_friendships_user_a_idTousers: UserRefSource;
    users_friendships_user_b_idTousers: UserRefSource;
  },
  viewerId: string,
): FriendDTO => ({
  user: toUserRef(
    friendship.user_a_id === viewerId
      ? friendship.users_friendships_user_b_idTousers
      : friendship.users_friendships_user_a_idTousers,
  ),
  friends_since: toIso(friendship.created_at),
});
