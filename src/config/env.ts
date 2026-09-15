import 'dotenv/config';

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Environment variable ${key} is required`);
  }
  return value;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 5000),
  databaseUrl: requireEnv('DATABASE_URL'),
  frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:3000',
  jwtAccessSecret: requireEnv('JWT_ACCESS_SECRET'),
  jwtAccessExpiresIn: requireEnv('JWT_ACCESS_EXPIRES_IN') ?? '15m',
};