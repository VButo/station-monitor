import { Router } from 'express';
import { smsRecieved, sendToDevice, getMessagesByStation, getUsernamesForMessages } from '../controllers/smsController';

const router = Router();

router.post('/', smsRecieved);
router.post('/send', sendToDevice);
router.get('/station/:stationId', getMessagesByStation);
router.post('/usernames', getUsernamesForMessages);

export default router;
