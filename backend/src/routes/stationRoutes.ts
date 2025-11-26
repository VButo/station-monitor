import { Router } from 'express';
import { getStations, getFieldNames, getStationById, fetchStationStatus, getAverageStatus, getAdvancedStationData, getPublicTableWithDatetime, getStatusTableWithDatetime, getMeasurementsTableWithDatetime, getStationOverviewData, getHourlyAverageFetchHealth, getHourlyAverageFetchHealth7d, getStationsTable, getStationsTableWithDatetime } from '../controllers/stationController';

const router = Router();

router.get('/', getStations);
router.get('/get-names', getFieldNames)
router.get('/station-status', fetchStationStatus);
router.get('/station-overview', getStationOverviewData);
router.get('/hourly-average-fetch-health', getHourlyAverageFetchHealth);
router.get('/hourly-average-fetch-health-7d', getHourlyAverageFetchHealth7d);
router.get('/average-status', getAverageStatus);
router.get('/advanced-table', getAdvancedStationData);
router.get('/stations-table/:id/:tableNameId', getStationsTable);
router.get('/table-datetime/:id/:tableNameId',  getStationsTableWithDatetime);
// New datetime-enabled routes - these accept datetime as query parameter
router.get('/public-table-datetime/:id', getPublicTableWithDatetime);
router.get('/status-table-datetime/:id', getStatusTableWithDatetime);
router.get('/measurements-table-datetime/:id', getMeasurementsTableWithDatetime);
router.get('/:id', getStationById);

export default router;