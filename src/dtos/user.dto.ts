type Amount = { toString(): string };

export interface UserDTO {
  id: string;
  name: string;
  email: string;
  emailVerifiedAt: Date | string | null;
}

export const toUserDTO = (user: {
  id: string;
  name: string;
  email: string;
  email_verified_at?: Date | string | null;
}): UserDTO => ({
  id: user.id,
  name: user.name,
  email: user.email,
  emailVerifiedAt: user.email_verified_at ?? null,
});

export interface ProfileDTO {
  username: string | null;
  fullName: string | null;
  avatarUrl: string | null;
  phone: string | null;
  bio: string | null;
  currency: string;
  timezone: string;
}

export const toProfileDTO = (profile: {
  username?: string | null;
  full_name?: string | null;
  avatar_url?: string | null;
  phone?: string | null;
  bio?: string | null;
  currency: string;
  timezone: string;
}): ProfileDTO => ({
  username: profile.username ?? null,
  fullName: profile.full_name ?? null,
  avatarUrl: profile.avatar_url ?? null,
  phone: profile.phone ?? null,
  bio: profile.bio ?? null,
  currency: profile.currency,
  timezone: profile.timezone,
});

export const toMoneyString = (value: Amount): string =>
  value.toString();