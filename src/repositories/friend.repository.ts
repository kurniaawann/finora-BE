import { prisma } from '../config/database.js';
import type { Prisma } from '../generated/prisma/client.js';
import type { friend_requests_status } from '../generated/prisma/enums.js';

export interface FriendRequestFilters {
  status?: friend_requests_status;
}

const userProfileSelect = {
  profiles: {
    select: {
      username: true,
      full_name: true,
      avatar_url: true,
    },
  },
} satisfies Prisma.UserInclude;

const requestInclude = {
  users_friend_requests_sender_idTousers: {
    include: userProfileSelect,
  },
  users_friend_requests_receiver_idTousers: {
    include: userProfileSelect,
  },
} satisfies Prisma.friend_requestsInclude;

export const friendPairIds = (
  userIdA: string,
  userIdB: string,
): { userAId: string; userBId: string } => {
  if (userIdA < userIdB) {
    return { userAId: userIdA, userBId: userIdB };
  }

  return { userAId: userIdB, userBId: userIdA };
};

export const searchUsers = async (params: {
  userId: string;
  search?: string;
  page: number;
  perPage: number;
}) => {
  const skip = (params.page - 1) * params.perPage;

  const conditions: Prisma.UserWhereInput[] = [
    {
      id: { not: params.userId },
      is_active: true,
    },
  ];

  if (params.search) {
    conditions.push({
      OR: [
        {
          name: {
            contains: params.search,
          },
        },
        {
          email: {
            contains: params.search,
          },
        },
        {
          profiles: {
            is: {
              username: {
                contains: params.search,
              },
            },
          },
        },
      ],
    });
  }

  const where: Prisma.UserWhereInput = {
    AND: conditions,
  };

  const [data, total] = await prisma.$transaction([
    prisma.user.findMany({
      where,
      orderBy: [
        {
          name: 'asc',
        },
        {
          created_at: 'asc',
        },
      ],
      skip,
      take: params.perPage,
      include: userProfileSelect,
    }),

    prisma.user.count({
      where,
    }),
  ]);

  const foundIds = data.map((user) => user.id);

  const [friendships, requests] =
    foundIds.length > 0
      ? await prisma.$transaction([
          prisma.friendships.findMany({
            where: {
              OR: [
                {
                  user_a_id: params.userId,
                  user_b_id: {
                    in: foundIds,
                  },
                },
                {
                  user_a_id: {
                    in: foundIds,
                  },
                  user_b_id: params.userId,
                },
              ],
            },
          }),

          prisma.friend_requests.findMany({
            where: {
              OR: [
                {
                  sender_id: params.userId,
                  receiver_id: {
                    in: foundIds,
                  },
                },
                {
                  sender_id: {
                    in: foundIds,
                  },
                  receiver_id: params.userId,
                },
              ],
            },
          }),
        ])
      : [[], []];

  const friendSet = new Set<string>();

  for (const friendship of friendships) {
    friendSet.add(
      friendship.user_a_id === params.userId
        ? friendship.user_b_id
        : friendship.user_a_id,
    );
  }

  const requestStatusByUser = new Map<
    string,
    string
  >();

  for (const request of requests) {
    const otherId =
      request.sender_id === params.userId
        ? request.receiver_id
        : request.sender_id;

    if (
      !requestStatusByUser.has(otherId) ||
      request.status === 'pending'
    ) {
      requestStatusByUser.set(otherId, request.status);
    }
  }

  const enriched = data.map((user) => ({
    ...user,
    request_status: friendSet.has(user.id)
      ? 'accepted'
      : (requestStatusByUser.get(user.id) ?? null),
  }));

  return {
    data: enriched,
    total,
  };
};

export const findUserByIdWithProfile = async (
  userId: string,
) => {
  return prisma.user.findUnique({
    where: {
      id: userId,
    },
    include: userProfileSelect,
  });
};

export const findFriendshipBetween = async (
  userIdA: string,
  userIdB: string,
) => {
  const { userAId, userBId } = friendPairIds(
    userIdA,
    userIdB,
  );

  return prisma.friendships.findUnique({
    where: {
      user_a_id_user_b_id: {
        user_a_id: userAId,
        user_b_id: userBId,
      },
    },
  });
};

export const findFriendRequestsBetween = async (
  userIdA: string,
  userIdB: string,
) => {
  return prisma.friend_requests.findFirst({
    where: {
      OR: [
        {
          sender_id: userIdA,
          receiver_id: userIdB,
        },
        {
          sender_id: userIdB,
          receiver_id: userIdA,
        },
      ],
    },
    include: requestInclude,
  });
};

export const createFriendRequest = async (data: {
  senderId: string;
  receiverId: string;
  message: string | null;
}) => {
  return prisma.friend_requests.create({
    data: {
      users_friend_requests_sender_idTousers: {
        connect: {
          id: data.senderId,
        },
      },
      users_friend_requests_receiver_idTousers: {
        connect: {
          id: data.receiverId,
        },
      },
      message: data.message,
    },
    include: requestInclude,
  });
};

export const reactivateFriendRequest = async (
  requestId: string,
  senderId: string,
  receiverId: string,
  message: string | null,
) => {
  return prisma.friend_requests.update({
    where: {
      id: requestId,
    },
    data: {
      users_friend_requests_sender_idTousers: {
        connect: {
          id: senderId,
        },
      },
      users_friend_requests_receiver_idTousers: {
        connect: {
          id: receiverId,
        },
      },
      status: 'pending',
      message,
      responded_at: null,
    },
    include: requestInclude,
  });
};

export const findFriendRequestById = async (
  requestId: string,
) => {
  return prisma.friend_requests.findUnique({
    where: {
      id: requestId,
    },
    include: requestInclude,
  });
};

export const findFriendRequestsByUser = async (params: {
  userId: string;
  direction: 'sent' | 'received';
  page: number;
  perPage: number;
  filters?: FriendRequestFilters;
}) => {
  const skip = (params.page - 1) * params.perPage;

  const conditions: Prisma.friend_requestsWhereInput[] = [
    params.direction === 'sent'
      ? { sender_id: params.userId }
      : { receiver_id: params.userId },
  ];

  if (params.filters?.status) {
    conditions.push({
      status: params.filters.status,
    });
  }

  const where: Prisma.friend_requestsWhereInput = {
    AND: conditions,
  };

  const [data, total] = await prisma.$transaction([
    prisma.friend_requests.findMany({
      where,
      orderBy: [
        {
          created_at: 'desc',
        },
      ],
      skip,
      take: params.perPage,
      include: requestInclude,
    }),

    prisma.friend_requests.count({
      where,
    }),
  ]);

  return {
    data,
    total,
  };
};

export const acceptFriendRequest = async (
  requestId: string,
  senderId: string,
  receiverId: string,
) => {
  const { userAId, userBId } = friendPairIds(
    senderId,
    receiverId,
  );

  return prisma.$transaction(async (tx) => {
    const updated = await tx.friend_requests.update({
      where: {
        id: requestId,
      },
      data: {
        status: 'accepted',
        responded_at: new Date(),
      },
      include: requestInclude,
    });

    await tx.friendships.create({
      data: {
        user_a_id: userAId,
        user_b_id: userBId,
      },
    });

    return updated;
  });
};

export const respondFriendRequest = async (
  requestId: string,
  status: 'rejected' | 'cancelled',
) => {
  return prisma.friend_requests.update({
    where: {
      id: requestId,
    },
    data: {
      status,
      responded_at: new Date(),
    },
    include: requestInclude,
  });
};

export const findFriendshipsByUser = async (params: {
  userId: string;
  search?: string;
  page: number;
  perPage: number;
}) => {
  const skip = (params.page - 1) * params.perPage;

  const conditions: Prisma.friendshipsWhereInput[] = [
    {
      OR: [
        {
          user_a_id: params.userId,
        },
        {
          user_b_id: params.userId,
        },
      ],
    },
  ];

  if (params.search) {
    conditions.push({
      OR: [
        {
          users_friendships_user_a_idTousers: {
            is: {
              name: {
                contains: params.search,
              },
            },
          },
        },
        {
          users_friendships_user_b_idTousers: {
            is: {
              name: {
                contains: params.search,
              },
            },
          },
        },
      ],
    });
  }

  const where: Prisma.friendshipsWhereInput = {
    AND: conditions,
  };

  const include = {
    users_friendships_user_a_idTousers: {
      include: userProfileSelect,
    },
    users_friendships_user_b_idTousers: {
      include: userProfileSelect,
    },
  } satisfies Prisma.friendshipsInclude;

  const [data, total] = await prisma.$transaction([
    prisma.friendships.findMany({
      where,
      orderBy: [
        {
          created_at: 'desc',
        },
      ],
      skip,
      take: params.perPage,
      include,
    }),

    prisma.friendships.count({
      where,
    }),
  ]);

  return {
    data,
    total,
  };
};

export const deleteFriendship = async (
  userId: string,
  friendId: string,
) => {
  const { userAId, userBId } = friendPairIds(
    userId,
    friendId,
  );

  return prisma.$transaction(async (tx) => {
    const result = await tx.friendships.deleteMany({
      where: {
        user_a_id: userAId,
        user_b_id: userBId,
      },
    });

    // Bersihkan sisa permintaan antar pasangan ini biar
    // nanti bisa langsung berteman lagi tanpa tersangkut
    // status 'accepted' yang basi.
    await tx.friend_requests.updateMany({
      where: {
        OR: [
          {
            sender_id: userId,
            receiver_id: friendId,
          },
          {
            sender_id: friendId,
            receiver_id: userId,
          },
        ],
      },
      data: {
        status: 'cancelled',
        responded_at: new Date(),
      },
    });

    return result;
  });
};