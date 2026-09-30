export interface AuthenticatedUser {
  id: string;
  email: string;
  /** Email sudah dibuktikan lewat kode OTP. */
  emailVerified: boolean;
}