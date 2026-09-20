import { prisma } from '../config/database.js';

export const createRefreshToken = async (data: {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
}) => {
  return prisma.refreshToken.create({
    data: {
      user_id: data.userId,
      token_hash: data.tokenHash,
      expires_at: data.expiresAt,
    },
  });
};

export const findRefreshToken = async (
  tokenHash: string,
) => {
  return prisma.refreshToken.findUnique({
    where: {
      token_hash: tokenHash,
    },
  });
};

export const revokeRefreshToken = async (
  tokenId: string,
) => {
  return prisma.refreshToken.update({
    where: {
      id: tokenId,
    },
    data: {
      revoked_at: new Date(),
    },
  });
};

export const revokeAllUserRefreshTokens = async (
  userId: string,
) => {
  return prisma.refreshToken.updateMany({
    where: {
      user_id: userId,
      revoked_at: null,
    },
    data: {
      revoked_at: new Date(),
    },
  });
};

export const replaceRefreshToken = async (
  oldTokenId: string,
  newTokenId: string,
) => {
  return prisma.refreshToken.update({
    where: {
      id: oldTokenId,
    },
    data: {
      revoked_at: new Date(),
      replaced_by_token_id: newTokenId,
    },
  });
};

export const rotateRefreshToken = async (data: {
  oldTokenId: string;
  newToken: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
  };
}) => {
  return prisma.$transaction(async (tx) => {
    const newToken = await tx.refreshToken.create({
      data: {
        user_id: data.newToken.userId,
        token_hash: data.newToken.tokenHash,
        expires_at: data.newToken.expiresAt,
      },
    });

    // Conditional update: hanya rotasi jika token lama masih aktif.
    // Kalau count 0, token sudah dipakai thread/request lain (race),
    // transaksi dibatalkan sehingga token baru tidak jadi disimpan.
    const result = await tx.refreshToken.updateMany({
      where: {
        id: data.oldTokenId,
        revoked_at: null,
      },
      data: {
        revoked_at: new Date(),
        replaced_by_token_id: newToken.id,
      },
    });

    if (result.count === 0) {
      throw new Error('REFRESH_TOKEN_REUSED');
    }

    return newToken;
  });
};

/**
 * Membersihkan baris refresh token yang sudah tidak berguna.
 *
 * Baris revoked/expired dipertahankan beberapa hari agar deteksi
 * pemakaian ulang (reuse detection) tetap berfungsi, lalu dihapus.
 */
export const pruneExpiredRefreshTokens = async () => {
  const cutoff = new Date(
    Date.now() - 7 * 24 * 60 * 60 * 1000,
  );

  return prisma.refreshToken.deleteMany({
    where: {
      OR: [
        {
          revoked_at: {
            not: null,
            lt: cutoff,
          },
        },
        {
          revoked_at: null,
          expires_at: {
            lt: cutoff,
          },
        },
      ],
    },
  });
};