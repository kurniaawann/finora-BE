import { Router } from 'express';

import { getHomeController } from '../controllers/home.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';

const router = Router();

router.use(authMiddleware);

router.get('/', getHomeController);

export default router;
