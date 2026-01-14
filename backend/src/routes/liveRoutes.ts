import { Router } from 'express';
import { getLiveData, enableLiveCollection, disableLiveCollection, getLiveSchedulerStatus } from '../controllers/liveController';

const router = Router();

// Request live data with stationId as path param and period/ttl as query params
// Example: /api/live/request_live_data/123?periodMs=10000&ttl_seconds=60
router.get('/get_live_data', getLiveData);
router.post('/collection/:stationId/enable', enableLiveCollection);
router.post('/collection/:stationId/disable', disableLiveCollection);
router.get('/collection/status', getLiveSchedulerStatus);

export default router;