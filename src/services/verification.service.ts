import crypto from 'node:crypto';

import { env } from '../config/env.js';
import type { verification_purpose } from '../generated/prisma/enums.js';
import {
  deleteExpiredVerificationCodes,
  findActiveVerificationCode,
  findLatestVerificationCode,
  incrementVerificationAttempts,
  markVerificationCodeUsed,
  replaceVerificationCode,
} from '../repositories/verification-code.repository.js';

export const CODE_TTL_MINUTES = 15;
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_SECONDS = 60;

/**
 * Kode 6 digit disimpan sebagai HMAC (bukan teks asli) dengan kunci
 * server, sehingga isi tabel tidak bisa dipakai walau bocor.
 */
const hashCode = (
  userId: string,
  purpose: verification_purpose,
  code: string,
) =>
  crypto
    .createHmac('sha256', env.jwtRefreshSecret)
    .update(`${purpose}:${userId}:${code}`)
    .digest('hex');

/** true bila kode terakhir dibuat kurang dari 60 detik lalu. */
export const isInResendCooldown = async (
  userId: string,
  purpose: verification_purpose,
) => {
  const latest = await findLatestVerificationCode(userId, purpose);

  return Boolean(
    latest &&
      Date.now() - latest.created_at.getTime() <
        RESEND_COOLDOWN_SECONDS * 1000,
  );
};

/** Buat kode baru (kode lama otomatis tidak berlaku) dan kembalikan teks aslinya. */
export const issueVerificationCode = async (
  userId: string,
  purpose: verification_purpose,
): Promise<string> => {
  const code = crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');

  await replaceVerificationCode({
    userId,
    purpose,
    codeHash: hashCode(userId, purpose, code),
    expiresAt: new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000),
  });

  return code;
};

/**
 * Cocokkan & habiskan kode. Setelah 5 kali salah, kode hangus dan user
 * harus meminta kode baru.
 */
export const consumeVerificationCode = async (
  userId: string,
  purpose: verification_purpose,
  code: string,
): Promise<boolean> => {
  const record = await findActiveVerificationCode(userId, purpose);

  if (!record || record.attempts >= MAX_ATTEMPTS) {
    return false;
  }

  const expected = Buffer.from(record.code_hash, 'hex');
  const actual = Buffer.from(hashCode(userId, purpose, code), 'hex');

  if (!crypto.timingSafeEqual(expected, actual)) {
    await incrementVerificationAttempts(record.id);
    return false;
  }

  return markVerificationCodeUsed(record.id);
};

export const pruneVerificationCodes = async () =>
  (await deleteExpiredVerificationCodes()).count;
