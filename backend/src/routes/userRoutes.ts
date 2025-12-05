import { Router, RequestHandler } from 'express';
import * as userController from '../controllers/userController';
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();

const shouldEnforceAuth = process.env.ENABLE_AUTH_MIDDLEWARE === 'true';
const passthroughAuth: RequestHandler = (_req, _res, next) => next();
const requireAuth: RequestHandler = shouldEnforceAuth ? authMiddleware : passthroughAuth;

router.post('/login', userController.login);
router.post('/logout', requireAuth, userController.logout);
router.get('/me', requireAuth, userController.getCurrentUser);

export default router;
