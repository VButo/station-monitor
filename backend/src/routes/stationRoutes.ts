import { Router } from 'express';
import { z } from 'zod';
import { getStations, getFieldNames, getStationById, fetchStationStatus, getAverageStatus, getAdvancedStationData, getAdvancedStationDataDateTime, getStationOverviewData, getHourlyAverageFetchHealth, getHourlyAverageFetchHealth7d, getStationsTable, getStationsTableWithDatetime } from '../controllers/stationController';
import { validateRequest } from '../middleware/validateRequest';

const router = Router();

const idParamSchema = z.object({
	id: z.coerce.number().int().positive(),
});

const tableParamsSchema = z.object({
	id: z.coerce.number().int().positive(),
	tableNameId: z.coerce.number().int().nonnegative(),
});

const datetimeQuerySchema = z.object({
	datetime: z.preprocess(
		(val) => (typeof val === 'string' ? val : undefined),
		z.string()
			.min(1, 'datetime is required')
			.refine((value) => !Number.isNaN(Date.parse(value)), 'Invalid datetime format. Expected ISO string.'),
	),
});

const datetimeParamSchema = z.object({
	datetime: z.string()
		.min(1, 'datetime is required')
		.refine((value) => !Number.isNaN(Date.parse(value)), 'Invalid datetime format. Expected ISO string.'),
});

router.get('/', getStations);
router.get('/get-names', getFieldNames)
router.get('/station-status', fetchStationStatus);
router.get('/station-overview', getStationOverviewData);
router.get('/hourly-average-fetch-health', getHourlyAverageFetchHealth);
router.get('/hourly-average-fetch-health-7d', getHourlyAverageFetchHealth7d);
router.get('/average-status', getAverageStatus);
router.get('/advanced-table', getAdvancedStationData);
// Datetime variant via query parameter (preferred)
router.get('/advanced-table-datetime', validateRequest({ query: datetimeQuerySchema }), getAdvancedStationDataDateTime);
router.get('/stations-table/:id/:tableNameId', validateRequest({ params: tableParamsSchema }), getStationsTable);
router.get('/table-datetime/:id/:tableNameId',  validateRequest({ params: tableParamsSchema, query: datetimeQuerySchema }), getStationsTableWithDatetime);
// New datetime-enabled routes - these accept datetime as query parameter
router.get('/:id', validateRequest({ params: idParamSchema }), getStationById);

export default router;