import { Router } from 'express';
import * as userController from '../controllers/userController';

const router = Router();

router.post('/login', userController.login);
router.post('/logout', userController.logout);
router.get('/me', userController.getCurrentUser);

export default router;
