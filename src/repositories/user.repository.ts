import { prisma } from '../config/database.js';
import type { Prisma } from '../generated/prisma/client.js';

const withProfile = {
  profiles: true,
} satisfies Prisma.UserInclude;

export const findUserByEmail = async (email: string) => {
  return prisma.user.findUnique({
    where: { email },
    include: withProfile,
  });
};

export const findUserById = async (userId: string) => {
  return prisma.user.findUnique({
    where: { id: userId },
    include: withProfile,
  });
};

/** Versi ringan untuk middleware auth yang dipanggil di setiap request. */
export const findAuthUserById = async (userId: string) => {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      email_verified_at: true,
      is_active: true,
    },
  });
};

export const findUserTimeZone = async (userId: string) => {
  const profile = await prisma.profile.findUnique({
    where: { user_id: userId },
    select: { timezone: true },
  });

  return profile?.timezone ?? null;
};

export const createUser = async (data: {
  name: string;
  email: string;
  password: string;
}) => {
  return prisma.user.create({
    data: {
      name: data.name,
      email: data.email,
      password: data.password,
      profiles: {
        create: {},
      },
    },
    include: withProfile,
  });
};

export const updateUserPassword = async (
  userId: string,
  password: string,
) => {
  return prisma.user.update({
    where: { id: userId },
    data: { password },
  });
};

export const markEmailVerified = (userId: string) =>
  prisma.user.update({
    where: { id: userId },
    data: { email_verified_at: new Date() },
    include: withProfile,
  });

export const findProfileByUsername = async (username: string) => {
  return prisma.profile.findUnique({
    where: { username },
    select: { user_id: true },
  });
};

export const updateUserAndProfile = async (
  userId: string,
  data: {
    user?: Prisma.UserUpdateInput;
    profile?: Prisma.ProfileUpdateInput;
  },
) => {
  return prisma.user.update({
    where: { id: userId },
    data: {
      ...data.user,
      ...(data.profile && {
        profiles: {
          upsert: {
            create: data.profile as Prisma.ProfileCreateWithoutUsersInput,
            update: data.profile,
          },
        },
      }),
    },
    include: withProfile,
  });
};

/**
 * Hapus akun dengan anonimisasi: data pribadi dibersihkan dan akun
 * dinonaktifkan, sementara catatan keuangan bersama di grup tetap utuh
 * agar saldo anggota lain tidak berubah.
 */
export const anonymizeUser = async (
  userId: string,
  randomPasswordHash: string,
) => {
  return prisma.$transaction(async (tx) => {
    await tx.refreshToken.deleteMany({ where: { user_id: userId } });
    await tx.device_tokens.deleteMany({ where: { user_id: userId } });
    await tx.verification_codes.deleteMany({ where: { user_id: userId } });
    await tx.friendships.deleteMany({
      where: {
        OR: [{ user_a_id: userId }, { user_b_id: userId }],
      },
    });
    await tx.friend_requests.deleteMany({
      where: {
        OR: [{ sender_id: userId }, { receiver_id: userId }],
      },
    });
    await tx.invitations.updateMany({
      where: {
        status: 'pending',
        OR: [{ inviter_id: userId }, { invitee_id: userId }],
      },
      data: { status: 'cancelled' },
    });
    // Pembayaran/pelunasan/setoran yang belum diproses dibatalkan agar
    // tidak ada transaksi baru yang tercatat atas nama akun yang dihapus.
    await tx.expense_payments.updateMany({
      where: { payer_id: userId, status: { in: ['pending', 'submitted'] } },
      data: { status: 'cancelled' },
    });
    await tx.settlements.updateMany({
      where: {
        status: 'pending',
        OR: [{ from_user_id: userId }, { to_user_id: userId }],
      },
      data: { status: 'cancelled' },
    });
    await tx.savings_contributions.updateMany({
      where: {
        contributor_id: userId,
        status: { in: ['pending', 'submitted'] },
      },
      data: { status: 'cancelled' },
    });
    await tx.recurring_transactions.updateMany({
      where: { user_id: userId },
      data: { is_active: false },
    });
    await tx.notifications.deleteMany({ where: { user_id: userId } });
    await tx.profile.updateMany({
      where: { user_id: userId },
      data: {
        username: null,
        full_name: null,
        avatar_url: null,
        phone: null,
        bio: null,
      },
    });

    return tx.user.update({
      where: { id: userId },
      data: {
        name: 'Pengguna Finora',
        email: `deleted+${userId}@finora.invalid`,
        password: randomPasswordHash,
        email_verified_at: null,
        is_active: false,
      },
    });
  });
};
