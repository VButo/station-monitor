import { Router } from 'express';
import { getStations, getStationById, getMeasurementsTable, getPublicTable, getStatusTable, fetchStationStatus, getAverageStatus, getAdvancedStationData } from '../controllers/stationController';

const router = Router();

router.get('/', getStations);
router.get('/station-status', fetchStationStatus);
router.get('/average-status', getAverageStatus);
router.get('/advanced-table', getAdvancedStationData);
router.get('/measurements-table/:id', getMeasurementsTable);
router.get('/public-table/:id', getPublicTable);
router.get('/status-table/:id', getStatusTable);
router.get('/:id', getStationById);

export default router;