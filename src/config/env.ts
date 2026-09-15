import 'dotenv/config'
const requiredEnv = [
    'DATABASE_URL'

];
for (const key of requiredEnv){
    if (!process.env[key]) {
        throw new Error(`Environment variable ${key} is required`);
        
    }
}
export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 5000),
  databaseUrl: process.env.DATABASE_URL,
  frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:3000',
};