import { Router } from 'express';
import { getStations, getStationById, getMeasurementsTable, getPublicTable, getStatusTable, fetchStationStatus, getAverageStatus, getAdvancedStationData, getPublicTableWithDatetime, getStatusTableWithDatetime, getMeasurementsTableWithDatetime, getStationOverviewData } from '../controllers/stationController';

const router = Router();

router.get('/', getStations);
router.get('/station-status', fetchStationStatus);
router.get('/station-overview', getStationOverviewData);
router.get('/average-status', getAverageStatus);
router.get('/advanced-table', getAdvancedStationData);
router.get('/measurements-table/:id', getMeasurementsTable);
router.get('/public-table/:id', getPublicTable);
router.get('/status-table/:id', getStatusTable);
// New datetime-enabled routes - these accept datetime as query parameter
router.get('/public-table-datetime/:id', getPublicTableWithDatetime);
router.get('/status-table-datetime/:id', getStatusTableWithDatetime);
router.get('/measurements-table-datetime/:id', getMeasurementsTableWithDatetime);
router.get('/:id', getStationById);

export default router;