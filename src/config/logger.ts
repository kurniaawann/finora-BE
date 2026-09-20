import winston from 'winston';
import { env } from './env.js';

const { combine, colorize, timestamp, printf, errors } = winston.format;

const logFormat = printf(({ level, message, timestamp, stack, ...meta }) => {
  const stackString = typeof stack === 'string' ? `\n${stack}` : '';
  const metaKeys = Object.keys(meta);
  const metaString =
    metaKeys.length > 0 ? ` ${JSON.stringify(meta)}` : '';

  return `${timestamp} [${level}]: ${message}${metaString}${stackString}`;
});

export const logger = winston.createLogger({
  level: env.logLevel,
  format: combine(
    errors({ stack: true }),
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    logFormat,
  ),
  transports: [
    new winston.transports.Console({
      format: combine(colorize(), logFormat),
    }),
  ],
});

export const httpLogStream = {
  write: (message: string) => {
    logger.info(message.trim());
  },
};