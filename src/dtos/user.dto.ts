import { toFileUrl, toIso } from './common.dto.js';

/**
 * Data user yang sedang login. Dipakai oleh /auth/*, dan /profile
 * agar aplikasi cukup menyimpan satu bentuk objek user.
 */
export interface MeDTO {
  id: string;
  name: string;
  email: string;
  email_verified: boolean;
  username: string | null;
  avatar_url: string | null;
  phone: string | null;
  bio: string | null;
  currency: string;
  timezone: string;
  created_at: string;
}

export const toMeDTO = (user: {
  id: string;
  name: string;
  email: string;
  email_verified_at: Date | null;
  created_at: Date | string;
  profiles?: {
    username?: string | null;
    avatar_url?: string | null;
    phone?: string | null;
    bio?: string | null;
    currency: string;
    timezone: string;
  } | null;
}): MeDTO => ({
  id: user.id,
  name: user.name,
  email: user.email,
  email_verified: user.email_verified_at !== null,
  username: user.profiles?.username ?? null,
  avatar_url: toFileUrl(user.profiles?.avatar_url),
  phone: user.profiles?.phone ?? null,
  bio: user.profiles?.bio ?? null,
  currency: user.profiles?.currency ?? 'IDR',
  timezone: user.profiles?.timezone ?? 'Asia/Jakarta',
  created_at: toIso(user.created_at),
});

export interface AuthTokensDTO {
  access_token: string;
  refresh_token: string;
  token_type: 'Bearer';
  /** Umur access token dalam detik. */
  expires_in: number;
}
