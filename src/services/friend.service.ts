import {
  acceptFriendRequest,
  createFriendRequest,
  deleteFriendship,
  findFriendRequestById,
  findFriendRequestsBetween,
  findFriendRequestsByUser,
  findFriendshipBetween,
  findFriendshipsByUser,
  reactivateFriendRequest,
  respondFriendRequest,
  searchUsers,
  findUserByIdWithProfile,
} from '../repositories/friend.repository.js';

import type { FriendRequestFilters } from '../repositories/friend.repository.js';

import type {
  SendFriendRequestInput,
} from '../validators/friend.validator.js';

export const searchUsersService = async (
  userId: string,
  search: string | undefined,
  page: number,
  perPage: number,
) => {
  return searchUsers({
    userId,
    search,
    page,
    perPage,
  });
};

export const sendFriendRequestService = async (
  userId: string,
  input: SendFriendRequestInput,
) => {
  if (input.receiver_id === userId) {
    throw new Error('SELF_FRIEND_REQUEST');
  }

  const receiver = await findUserByIdWithProfile(
    input.receiver_id,
  );

  if (!receiver || !receiver.is_active) {
    throw new Error('USER_NOT_FOUND');
  }

  const existingFriendship = await findFriendshipBetween(
    userId,
    input.receiver_id,
  );

  if (existingFriendship) {
    throw new Error('ALREADY_FRIENDS');
  }

  const existingRequest = await findFriendRequestsBetween(
    userId,
    input.receiver_id,
  );

  if (existingRequest) {
    if (existingRequest.status === 'pending') {
      throw new Error('REQUEST_ALREADY_PENDING');
    }

    // Kalau status 'accepted' tapi tak ada friendship (alias sudah
    // unfriend), reactivate: aktifkan kembali baris yang sama agar
    // unique pair tetap terjaga.
    return reactivateFriendRequest(
      existingRequest.id,
      userId,
      input.receiver_id,
      input.message ?? null,
    );
  }

  return createFriendRequest({
    senderId: userId,
    receiverId: input.receiver_id,
    message: input.message ?? null,
  });
};

export const getFriendRequestsService = async (
  userId: string,
  direction: 'sent' | 'received',
  page: number,
  perPage: number,
  filters: FriendRequestFilters = {},
) => {
  return findFriendRequestsByUser({
    userId,
    direction,
    page,
    perPage,
    filters,
  });
};

const ensurePendingRequest = async (
  requestId: string,
  userId: string,
  role: 'sender' | 'receiver',
) => {
  const request = await findFriendRequestById(requestId);

  if (!request) {
    throw new Error('REQUEST_NOT_FOUND');
  }

  if (
    role === 'sender' &&
    request.sender_id !== userId
  ) {
    throw new Error('REQUEST_NOT_AUTHORIZED');
  }

  if (
    role === 'receiver' &&
    request.receiver_id !== userId
  ) {
    throw new Error('REQUEST_NOT_AUTHORIZED');
  }

  if (request.status !== 'pending') {
    throw new Error('REQUEST_ALREADY_RESPONDED');
  }

  return request;
};

export const acceptFriendRequestService = async (
  userId: string,
  requestId: string,
) => {
  const request = await ensurePendingRequest(
    requestId,
    userId,
    'receiver',
  );

  // Lindungi dari race condition: pastikan belum jadi teman.
  const existingFriendship = await findFriendshipBetween(
    request.sender_id,
    request.receiver_id,
  );

  if (existingFriendship) {
    throw new Error('ALREADY_FRIENDS');
  }

  return acceptFriendRequest(
    requestId,
    request.sender_id,
    request.receiver_id,
  );
};

export const rejectFriendRequestService = async (
  userId: string,
  requestId: string,
) => {
  await ensurePendingRequest(requestId, userId, 'receiver');

  return respondFriendRequest(requestId, 'rejected');
};

export const cancelFriendRequestService = async (
  userId: string,
  requestId: string,
) => {
  await ensurePendingRequest(requestId, userId, 'sender');

  return respondFriendRequest(requestId, 'cancelled');
};

export const getFriendsService = async (
  userId: string,
  search: string | undefined,
  page: number,
  perPage: number,
) => {
  return findFriendshipsByUser({
    userId,
    search,
    page,
    perPage,
  });
};

export const unfriendService = async (
  userId: string,
  friendId: string,
) => {
  const friendship = await findFriendshipBetween(
    userId,
    friendId,
  );

  if (!friendship) {
    throw new Error('FRIEND_NOT_FOUND');
  }

  const result = await deleteFriendship(
    userId,
    friendId,
  );

  if (result.count === 0) {
    throw new Error('FRIEND_NOT_FOUND');
  }

  return true;
};