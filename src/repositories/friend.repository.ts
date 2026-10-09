import { prisma } from '../config/database.js';
import { userRefSelect } from '../dtos/common.dto.js';
import type { Prisma } from '../generated/prisma/client.js';
import type { friend_requests_status } from '../generated/prisma/enums.js';

/** Pertemanan disimpan sebagai pasangan terurut (user_a_id < user_b_id). */
const orderedPair = (userIdA: string, userIdB: string) =>
  userIdA < userIdB
    ? { user_a_id: userIdA, user_b_id: userIdB }
    : { user_a_id: userIdB, user_b_id: userIdA };

const requestSelect = {
  id: true,
  sender_id: true,
  receiver_id: true,
  status: true,
  message: true,
  created_at: true,
  users_friend_requests_sender_idTousers: { select: userRefSelect },
  users_friend_requests_receiver_idTousers: { select: userRefSelect },
} satisfies Prisma.friend_requestsSelect;

const matchUserName = (search: string): Prisma.UserWhereInput => ({
  OR: [
    { name: { contains: search } },
    { profiles: { is: { username: { contains: search } } } },
  ],
});

export const searchActiveUsers = async (params: {
  excludeUserId: string;
  search: string;
  page: number;
  perPage: number;
}) => {
  const where: Prisma.UserWhereInput = {
    id: { not: params.excludeUserId },
    is_active: true,
    ...matchUserName(params.search),
  };

  const [data, total] = await prisma.$transaction([
    prisma.user.findMany({
      where,
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      skip: (params.page - 1) * params.perPage,
      take: params.perPage,
      select: userRefSelect,
    }),
    prisma.user.count({ where }),
  ]);

  return { data, total };
};

export const findFriendshipsWith = (userId: string, otherIds: string[]) =>
  prisma.friendships.findMany({
    where: {
      OR: [
        { user_a_id: userId, user_b_id: { in: otherIds } },
        { user_b_id: userId, user_a_id: { in: otherIds } },
      ],
    },
    select: { user_a_id: true, user_b_id: true },
  });

export const findPendingRequestsWith = (userId: string, otherIds: string[]) =>
  prisma.friend_requests.findMany({
    where: {
      status: 'pending',
      OR: [
        { sender_id: userId, receiver_id: { in: otherIds } },
        { receiver_id: userId, sender_id: { in: otherIds } },
      ],
    },
    select: { id: true, sender_id: true, receiver_id: true },
  });

export const areFriends = async (userIdA: string, userIdB: string) =>
  (await prisma.friendships.count({
    where: orderedPair(userIdA, userIdB),
  })) > 0;

export const findFriendRequestById = (requestId: string) =>
  prisma.friend_requests.findUnique({
    where: { id: requestId },
    select: requestSelect,
  });

/** Satu baris per arah (sender → receiver), dijaga unique key. */
export const findFriendRequestByPair = (senderId: string, receiverId: string) =>
  prisma.friend_requests.findUnique({
    where: {
      sender_id_receiver_id: { sender_id: senderId, receiver_id: receiverId },
    },
    select: requestSelect,
  });

export const createFriendRequest = (data: {
  senderId: string;
  receiverId: string;
  message: string | null;
}) =>
  prisma.friend_requests.create({
    data: {
      sender_id: data.senderId,
      receiver_id: data.receiverId,
      message: data.message,
    },
    select: requestSelect,
  });

/** Pakai ulang baris lama (ditolak/dibatalkan) sebagai permintaan baru. */
export const resendFriendRequest = (
  requestId: string,
  message: string | null,
) =>
  prisma.friend_requests.update({
    where: { id: requestId },
    data: {
      status: 'pending',
      message,
      responded_at: null,
      created_at: new Date(),
    },
    select: requestSelect,
  });

/**
 * Terima permintaan dan bentuk pertemanan secara atomik. Mengembalikan
 * null bila permintaan sudah tidak pending (diproses request lain).
 */
export const acceptFriendRequest = (
  requestId: string,
  senderId: string,
  receiverId: string,
) =>
  prisma.$transaction(async (tx) => {
    const respondedAt = new Date();

    const { count } = await tx.friend_requests.updateMany({
      where: { id: requestId, status: 'pending' },
      data: { status: 'accepted', responded_at: respondedAt },
    });

    if (count === 0) {
      return null;
    }

    // Permintaan arah sebaliknya (bila ada) ikut dianggap diterima.
    await tx.friend_requests.updateMany({
      where: { sender_id: receiverId, receiver_id: senderId, status: 'pending' },
      data: { status: 'accepted', responded_at: respondedAt },
    });

    const pair = orderedPair(senderId, receiverId);

    await tx.friendships.upsert({
      where: { user_a_id_user_b_id: pair },
      create: pair,
      update: {},
    });

    return tx.friend_requests.findUniqueOrThrow({
      where: { id: requestId },
      select: requestSelect,
    });
  });

/** Tolak/batalkan permintaan pending; null bila sudah diproses. */
export const closeFriendRequest = async (
  requestId: string,
  status: 'rejected' | 'cancelled',
) => {
  const { count } = await prisma.friend_requests.updateMany({
    where: { id: requestId, status: 'pending' },
    data: { status, responded_at: new Date() },
  });

  return count === 0 ? null : findFriendRequestById(requestId);
};

export const findFriendRequestsForUser = async (params: {
  userId: string;
  direction: 'sent' | 'received';
  status?: friend_requests_status;
  page: number;
  perPage: number;
}) => {
  const where: Prisma.friend_requestsWhereInput = {
    ...(params.direction === 'sent'
      ? { sender_id: params.userId }
      : { receiver_id: params.userId }),
    ...(params.status ? { status: params.status } : {}),
  };

  const [data, total] = await prisma.$transaction([
    prisma.friend_requests.findMany({
      where,
      orderBy: [{ created_at: 'desc' }],
      skip: (params.page - 1) * params.perPage,
      take: params.perPage,
      select: requestSelect,
    }),
    prisma.friend_requests.count({ where }),
  ]);

  return { data, total };
};

export const findFriendsOfUser = async (params: {
  userId: string;
  search?: string;
  page: number;
  perPage: number;
}) => {
  const match = params.search ? matchUserName(params.search) : undefined;

  // Pencarian hanya pada sisi teman, bukan pada diri sendiri.
  const where: Prisma.friendshipsWhereInput = {
    OR: [
      {
        user_a_id: params.userId,
        ...(match && { users_friendships_user_b_idTousers: match }),
      },
      {
        user_b_id: params.userId,
        ...(match && { users_friendships_user_a_idTousers: match }),
      },
    ],
  };

  const [data, total] = await prisma.$transaction([
    prisma.friendships.findMany({
      where,
      orderBy: [{ created_at: 'desc' }],
      skip: (params.page - 1) * params.perPage,
      take: params.perPage,
      select: {
        user_a_id: true,
        created_at: true,
        users_friendships_user_a_idTousers: { select: userRefSelect },
        users_friendships_user_b_idTousers: { select: userRefSelect },
      },
    }),
    prisma.friendships.count({ where }),
  ]);

  return { data, total };
};

/**
 * Hapus pertemanan dan tutup permintaan lama di kedua arah agar
 * keduanya bisa saling mengirim permintaan baru nanti.
 */
export const deleteFriendship = (userId: string, friendId: string) =>
  prisma.$transaction(async (tx) => {
    const { count } = await tx.friendships.deleteMany({
      where: orderedPair(userId, friendId),
    });

    if (count > 0) {
      await tx.friend_requests.updateMany({
        where: {
          status: { in: ['pending', 'accepted'] },
          OR: [
            { sender_id: userId, receiver_id: friendId },
            { sender_id: friendId, receiver_id: userId },
          ],
        },
        data: { status: 'cancelled', responded_at: new Date() },
      });
    }

    return count;
  });
