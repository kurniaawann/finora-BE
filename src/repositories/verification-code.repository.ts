import { prisma } from '../config/database.js';
import type { verification_purpose } from '../generated/prisma/enums.js';

/** Kode baru menggantikan semua kode lama dengan tujuan yang sama. */
export const replaceVerificationCode = (data: {
  userId: string;
  purpose: verification_purpose;
  codeHash: string;
  expiresAt: Date;
}) =>
  prisma.$transaction([
    prisma.verification_codes.deleteMany({
      where: { user_id: data.userId, purpose: data.purpose },
    }),
    prisma.verification_codes.create({
      data: {
        user_id: data.userId,
        purpose: data.purpose,
        code_hash: data.codeHash,
        expires_at: data.expiresAt,
      },
    }),
  ]);

export const findActiveVerificationCode = (
  userId: string,
  purpose: verification_purpose,
) =>
  prisma.verification_codes.findFirst({
    where: {
      user_id: userId,
      purpose,
      used_at: null,
      expires_at: { gt: new Date() },
    },
    orderBy: { created_at: 'desc' },
  });

export const findLatestVerificationCode = (
  userId: string,
  purpose: verification_purpose,
) =>
  prisma.verification_codes.findFirst({
    where: { user_id: userId, purpose },
    orderBy: { created_at: 'desc' },
    select: { created_at: true },
  });

export const incrementVerificationAttempts = (id: string) =>
  prisma.verification_codes.update({
    where: { id },
    data: { attempts: { increment: 1 } },
  });

/** Tandai terpakai secara bersyarat agar kode tidak bisa dipakai dua kali. */
export const markVerificationCodeUsed = async (id: string) => {
  const result = await prisma.verification_codes.updateMany({
    where: { id, used_at: null },
    data: { used_at: new Date() },
  });

  return result.count === 1;
};

export const deleteExpiredVerificationCodes = () =>
  prisma.verification_codes.deleteMany({
    where: {
      OR: [
        { expires_at: { lt: new Date() } },
        { used_at: { not: null } },
      ],
    },
  });
