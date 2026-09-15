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

export const revokeRefreshTokenByHash = async (
  tokenHash: string,
) => {
  return prisma.refreshToken.update({
    where: {
      token_hash: tokenHash,
    },
    data: {
      revoked_at: new Date(),
    },
  });
};