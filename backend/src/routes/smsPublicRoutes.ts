import { Router } from 'express';
import { z } from 'zod';
import { smsRecieved } from '../controllers/smsController';
import { validateRequest } from '../middleware/validateRequest';

// Public router for inbound SMS webhook from router/device.
// This endpoint is intentionally NOT protected by authMiddleware.
// If you need protection, add a shared secret header/token validation here.

const router = Router();

const smsPayloadSchema = z.object({
  number: z.string().trim().min(3, 'number is required'),
  message: z.string().trim().min(1, 'message is required'),
});

// Inbound webhook: POST /api/sms
router.post('/', validateRequest({ body: smsPayloadSchema }), smsRecieved);

export default router;