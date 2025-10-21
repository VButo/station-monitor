import { Router } from 'express';
import { getOverviewData24hHandler, getOverviewData7dHandler, getOnlineData24hHandler, getOnlineData7dHandler } from '../controllers/overviewController';

const router = Router();

// GET /api/overview-data-24h - Get current overview data (station status, health, etc.)
router.get('/overview-data-24h', getOverviewData24hHandler);

// GET /api/overview-data-7d - Get 7-day overview data (station status, health, etc.)
router.get('/overview-data-7d', getOverviewData7dHandler);

// GET /api/online-data-24h - Get 24-hour online/offline history
router.get('/online-data-24h', getOnlineData24hHandler);

// GET /api/online-data-7d - Get 7-day online/offline history
router.get('/online-data-7d', getOnlineData7dHandler);

export default router;