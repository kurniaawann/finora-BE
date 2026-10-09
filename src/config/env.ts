import 'dotenv/config';
import { z } from 'zod';

/**
 * Hanya nilai yang berbeda per environment (lokal/staging/produksi)
 * atau yang bersifat rahasia yang dibaca dari env. Aturan bisnis
 * (batas upload, pagination, rate limit, dll) tetap di kode.
 */
const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),

  PORT: z.coerce.number().int().positive().default(5000),

  // URL publik server, dipakai untuk membentuk URL foto absolut
  // yang dikirim ke aplikasi mobile.
  APP_URL: z.url().default('http://localhost:5000'),

  DATABASE_URL: z.string().min(1),

  JWT_ACCESS_SECRET: z
    .string()
    .min(32, 'JWT_ACCESS_SECRET minimal 32 karakter'),
  JWT_REFRESH_SECRET: z
    .string()
    .min(32, 'JWT_REFRESH_SECRET minimal 32 karakter'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('30d'),

  // Folder penyimpanan foto. Di produksi arahkan ke volume persisten.
  UPLOAD_DIR: z.string().default('uploads'),

  // Opsional: daftar origin web (dipisah koma) yang boleh memanggil API.
  // Aplikasi mobile native tidak butuh CORS, jadi default-nya kosong.
  CORS_ORIGINS: z.string().default(''),

  // Jumlah reverse proxy di depan server (0 = tanpa proxy).
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),

  LOG_LEVEL: z
    .enum(['error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly'])
    .default('info'),

  // Firebase Admin (push notification FCM). Diambil dari file service
  // account JSON; kosongkan semua untuk mematikan push.
  FIREBASE_PROJECT_ID: z.string().default(''),
  FIREBASE_CLIENT_EMAIL: z.string().default(''),
  FIREBASE_PRIVATE_KEY: z.string().default(''),

  // SMTP untuk email OTP (verifikasi email & reset password).
  SMTP_HOST: z.string().default(''),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_SECURE: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  SMTP_USER: z.string().default(''),
  SMTP_PASS: z.string().default(''),
  MAIL_FROM: z.string().default('Finora <no-reply@finora.app>'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues
    .map((issue) => `- ${issue.path.join('.')}: ${issue.message}`)
    .join('\n');

  throw new Error(`Konfigurasi environment tidak valid:\n${details}`);
}

const raw = parsed.data;

export const env = {
  nodeEnv: raw.NODE_ENV,
  isProduction: raw.NODE_ENV === 'production',
  port: raw.PORT,
  appUrl: raw.APP_URL.replace(/\/+$/, ''),
  databaseUrl: raw.DATABASE_URL,
  jwtAccessSecret: raw.JWT_ACCESS_SECRET,
  jwtAccessExpiresIn: raw.JWT_ACCESS_EXPIRES_IN,
  jwtRefreshSecret: raw.JWT_REFRESH_SECRET,
  jwtRefreshExpiresIn: raw.JWT_REFRESH_EXPIRES_IN,
  uploadDir: raw.UPLOAD_DIR,
  corsOrigins: raw.CORS_ORIGINS.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  trustProxy: raw.TRUST_PROXY,
  logLevel: raw.LOG_LEVEL,
  firebase: {
    projectId: raw.FIREBASE_PROJECT_ID,
    clientEmail: raw.FIREBASE_CLIENT_EMAIL,
    // Private key di env biasanya ditulis dengan "\n" literal.
    privateKey: raw.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  },
  smtp: {
    host: raw.SMTP_HOST,
    port: raw.SMTP_PORT,
    secure: raw.SMTP_SECURE,
    user: raw.SMTP_USER,
    pass: raw.SMTP_PASS,
    from: raw.MAIL_FROM,
  },
} as const;
