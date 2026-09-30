import type { FriendshipStatus } from '../dtos/friend.dto.js';
import type { friend_requests_status } from '../generated/prisma/enums.js';
import {
  acceptFriendRequest as acceptPendingRequest,
  areFriends,
  closeFriendRequest,
  createFriendRequest,
  deleteFriendship,
  findFriendRequestById,
  findFriendRequestByPair,
  findFriendRequestsForUser,
  findFriendsOfUser,
  findFriendshipsWith,
  findPendingRequestsWith,
  resendFriendRequest,
  searchActiveUsers,
} from '../repositories/friend.repository.js';
import { findUserById } from '../repositories/user.repository.js';
import {
  conflict,
  forbidden,
  notFound,
  unprocessable,
} from '../utils/app-error.js';
import type { PaginationParams } from '../utils/pagination.js';
import type { SendFriendRequestInput } from '../validators/friend.validator.js';
import { notify } from './notifier.service.js';

const MIN_SEARCH_LENGTH = 2;

type FriendRequest = NonNullable<
  Awaited<ReturnType<typeof findFriendRequestById>>
>;

const alreadyResponded = () =>
  conflict(
    'FRIEND_REQUEST_ALREADY_RESPONDED',
    'Permintaan pertemanan sudah ditanggapi',
  );

const requirePendingRequest = async (
  requestId: string,
  userId: string,
  role: 'sender' | 'receiver',
) => {
  const request = await findFriendRequestById(requestId);

  if (
    !request ||
    (request.sender_id !== userId && request.receiver_id !== userId)
  ) {
    throw notFound(
      'FRIEND_REQUEST_NOT_FOUND',
      'Permintaan pertemanan tidak ditemukan',
    );
  }

  const actorId = role === 'sender' ? request.sender_id : request.receiver_id;

  if (actorId !== userId) {
    throw forbidden(
      'FRIEND_REQUEST_FORBIDDEN',
      role === 'sender'
        ? 'Hanya pengirim yang bisa membatalkan permintaan ini'
        : 'Hanya penerima yang bisa menanggapi permintaan ini',
    );
  }

  if (request.status !== 'pending') {
    throw alreadyResponded();
  }

  return request;
};

const acceptRequest = async (request: FriendRequest) => {
  const accepted = await acceptPendingRequest(
    request.id,
    request.sender_id,
    request.receiver_id,
  );

  if (!accepted) {
    throw alreadyResponded();
  }

  await notify({
    userIds: accepted.sender_id,
    type: 'friend',
    title: 'Permintaan pertemanan diterima',
    message: `${accepted.users_friend_requests_receiver_idTousers.name} menerima permintaan pertemananmu`,
    data: {
      friend_request_id: accepted.id,
      user_id: accepted.receiver_id,
    },
    excludeUserId: accepted.receiver_id,
  });

  return accepted;
};

export const searchUsers = async (
  userId: string,
  search: string | undefined,
  pagination: PaginationParams,
) => {
  if (!search || search.length < MIN_SEARCH_LENGTH) {
    throw unprocessable(
      'SEARCH_QUERY_TOO_SHORT',
      `Kata kunci pencarian minimal ${MIN_SEARCH_LENGTH} karakter`,
    );
  }

  const result = await searchActiveUsers({
    excludeUserId: userId,
    search,
    ...pagination,
  });

  const ids = result.data.map((user) => user.id);

  const [friendships, pendingRequests] =
    ids.length > 0
      ? await Promise.all([
          findFriendshipsWith(userId, ids),
          findPendingRequestsWith(userId, ids),
        ])
      : [[], []];

  const friendIds = new Set(
    friendships.map((friendship) =>
      friendship.user_a_id === userId
        ? friendship.user_b_id
        : friendship.user_a_id,
    ),
  );

  const requestByUser = new Map(
    pendingRequests.map((request) => [
      request.sender_id === userId ? request.receiver_id : request.sender_id,
      request,
    ]),
  );

  return {
    total: result.total,
    data: result.data.map((user) => {
      const request = requestByUser.get(user.id);
      let status: FriendshipStatus = 'none';

      if (friendIds.has(user.id)) {
        status = 'friends';
      } else if (request) {
        status =
          request.sender_id === userId ? 'request_sent' : 'request_received';
      }

      return {
        user,
        friendship_status: status,
        friend_request_id: status === 'friends' ? null : (request?.id ?? null),
      };
    }),
  };
};

/**
 * Kirim permintaan pertemanan. Bila lawan sudah lebih dulu mengirim
 * permintaan yang masih pending, permintaan itu langsung diterima.
 */
export const sendFriendRequest = async (
  userId: string,
  input: SendFriendRequestInput,
) => {
  if (input.receiver_id === userId) {
    throw unprocessable(
      'SELF_FRIEND_REQUEST',
      'Kamu tidak bisa berteman dengan diri sendiri',
    );
  }

  const receiver = await findUserById(input.receiver_id);

  if (!receiver || !receiver.is_active) {
    throw notFound('USER_NOT_FOUND', 'Pengguna tidak ditemukan');
  }

  if (await areFriends(userId, receiver.id)) {
    throw conflict('ALREADY_FRIENDS', 'Kalian sudah berteman');
  }

  const incoming = await findFriendRequestByPair(receiver.id, userId);

  if (incoming?.status === 'pending') {
    return { request: await acceptRequest(incoming), autoAccepted: true };
  }

  const existing = await findFriendRequestByPair(userId, receiver.id);

  if (existing?.status === 'pending') {
    throw conflict(
      'REQUEST_ALREADY_PENDING',
      'Permintaan pertemanan sudah terkirim dan menunggu tanggapan',
    );
  }

  const message = input.message ?? null;

  // Unique key per arah: baris lama (ditolak/dibatalkan) dipakai ulang.
  const request = existing
    ? await resendFriendRequest(existing.id, message)
    : await createFriendRequest({
        senderId: userId,
        receiverId: receiver.id,
        message,
      });

  await notify({
    userIds: receiver.id,
    type: 'friend',
    title: 'Permintaan pertemanan',
    message: `${request.users_friend_requests_sender_idTousers.name} ingin berteman denganmu`,
    data: { friend_request_id: request.id, user_id: userId },
    excludeUserId: userId,
  });

  return { request, autoAccepted: false };
};

export const listFriendRequests = (
  userId: string,
  pagination: PaginationParams,
  filters: {
    direction: 'sent' | 'received';
    status?: friend_requests_status;
  },
) => findFriendRequestsForUser({ userId, ...pagination, ...filters });

export const acceptFriendRequest = async (
  userId: string,
  requestId: string,
) => acceptRequest(await requirePendingRequest(requestId, userId, 'receiver'));

export const rejectFriendRequest = async (
  userId: string,
  requestId: string,
) => {
  await requirePendingRequest(requestId, userId, 'receiver');

  const rejected = await closeFriendRequest(requestId, 'rejected');

  if (!rejected) {
    throw alreadyResponded();
  }

  await notify({
    userIds: rejected.sender_id,
    type: 'friend',
    title: 'Permintaan pertemanan ditolak',
    message: `${rejected.users_friend_requests_receiver_idTousers.name} menolak permintaan pertemananmu`,
    data: { friend_request_id: rejected.id, user_id: userId },
    excludeUserId: userId,
  });

  return rejected;
};

export const cancelFriendRequest = async (
  userId: string,
  requestId: string,
) => {
  await requirePendingRequest(requestId, userId, 'sender');

  const cancelled = await closeFriendRequest(requestId, 'cancelled');

  if (!cancelled) {
    throw alreadyResponded();
  }

  return cancelled;
};

export const listFriends = (
  userId: string,
  pagination: PaginationParams,
  search: string | undefined,
) => findFriendsOfUser({ userId, search, ...pagination });

export const unfriend = async (userId: string, friendId: string) => {
  if ((await deleteFriendship(userId, friendId)) === 0) {
    throw notFound('FRIEND_NOT_FOUND', 'Teman tidak ditemukan');
  }
};
