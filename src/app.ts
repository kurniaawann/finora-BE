import express, {
  type NextFunction,
  type Request,
  type Response,
} from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';

import { env } from './config/env.js';
import { httpLogStream, logger } from './config/logger.js';
import routes from './routes/index.js';
import { fail } from './utils/response.js';
import { generalRateLimiter } from './middlewares/rateLimiter.middleware.js';

const app = express();

app.use(helmet());

app.use(morgan(env.nodeEnv === 'development' ? 'dev' : 'combined', { stream: httpLogStream }));

app.use(generalRateLimiter);

app.use(
  cors({
    origin: env.frontendUrl,
    credentials: true,
  }),
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(cookieParser());

app.use('/api', routes);

app.use(
  (
    error: Error & { status?: number; type?: string },
    _req: Request,
    res: Response,
    _next: NextFunction,
  ) => {
    if (
      error instanceof SyntaxError &&
      error.status === 400 &&
      'body' in error
    ) {
      return fail(res, 400, 'Format JSON tidak valid');
    }

    if (error.type === 'entity.too.large') {
      return fail(res, 413, 'Ukuran payload terlalu besar');
    }

    logger.error('Unhandled error:', error);

    return fail(res, 500, 'Terjadi kesalahan pada server');
  },
);

export default app;