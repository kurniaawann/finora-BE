import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';

import { env } from './config/env.js';
import { httpLogStream } from './config/logger.js';
import {
  ensureUploadDir,
  uploadDir,
  uploadUrlPrefix,
} from './config/upload.js';
import {
  errorHandler,
  notFoundHandler,
} from './middlewares/error.middleware.js';
import { generalRateLimiter } from './middlewares/rateLimiter.middleware.js';
import routes from './routes/index.js';

ensureUploadDir();

const app = express();

app.set('trust proxy', env.trustProxy);
app.disable('x-powered-by');

app.use(helmet());
app.use(
  morgan(env.isProduction ? 'combined' : 'dev', {
    stream: httpLogStream,
  }),
);

// Aplikasi mobile native tidak terikat CORS; origin web hanya diizinkan
// bila didaftarkan lewat CORS_ORIGINS (mis. dashboard admin).
app.use(
  cors({
    origin: env.corsOrigins.length > 0 ? env.corsOrigins : false,
  }),
);

// Foto disajikan statis; nama file acak 128-bit sehingga tidak bisa ditebak.
app.use(
  uploadUrlPrefix,
  express.static(uploadDir, {
    immutable: true,
    maxAge: '30d',
    index: false,
    setHeaders: (res) => {
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    },
  }),
);

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

app.use('/api', generalRateLimiter, routes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
