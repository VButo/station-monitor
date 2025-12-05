import { Router } from 'express';
import { z } from 'zod';
import { smsRecieved, sendToDevice, getMessagesByStation, getUsernamesForMessages } from '../controllers/smsController';
import { validateRequest } from '../middleware/validateRequest';

const router = Router();

const smsPayloadSchema = z.object({
	number: z.string().trim().min(3, 'number is required'),
	message: z.string().trim().min(1, 'message is required'),
});

const sendSmsSchema = smsPayloadSchema.extend({
	station_id: z.union([
		z.coerce.number().int().positive(),
		z.literal(null),
	]).optional(),
});

const stationIdParamsSchema = z.object({
	stationId: z.coerce.number().int().positive(),
});

const userIdsSchema = z.object({
	userIds: z.array(z.string().trim().min(1)).max(500, 'Too many userIds provided'),
});

router.post('/', validateRequest({ body: smsPayloadSchema }), smsRecieved);
router.post('/send', validateRequest({ body: sendSmsSchema }), sendToDevice);
router.get('/station/:stationId', validateRequest({ params: stationIdParamsSchema }), getMessagesByStation);
router.post('/usernames', validateRequest({ body: userIdsSchema }), getUsernamesForMessages);

export default router;
