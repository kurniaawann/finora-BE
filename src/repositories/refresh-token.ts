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

    await tx.refreshToken.update({
      where: {
        id: data.oldTokenId,
      },
      data: {
        revoked_at: new Date(),
        replaced_by_token_id: newToken.id,
      },
    });

    return newToken;
  });
};