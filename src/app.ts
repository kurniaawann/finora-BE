import express from 'express';
import cors from 'cors';
import helmet from 'helmet';

import { env } from './config/env.js';
import routes from './routes/index.js';

const app = express();
app.use(helmet());
app.use(
    cors({
        origin: env.frontendUrl,
        credentials: true
    }),
);
app.use(express.json());
app.use(express.urlencoded({extended:true}));
app.use('/api', routes);
export default app;
