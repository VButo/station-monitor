import { Request, Response } from 'express';
import * as stationService from '../services/stationService';
import * as fieldService from '../services/fieldService';
import { advancedStationDataCache } from '../services/cacheService';
import { supabase, createFreshSupabaseClient } from '../utils/supabaseClient';
import { logger } from '../utils/logger';

const freshSupabase = createFreshSupabaseClient();

export async function getAverageStatus(req: Request, res: Response) {
  try {
    const data = await stationService.getAverageStatus();
    res.json(data);
  } catch (error: unknown) {
    if (error instanceof Error) {
      res.status(500).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Unknown error' });
    }
  }
}
export async function fetchStationStatus(req: Request, res: Response) {
  try {
    const data = await stationService.fetchStationStatus();
    res.json(data);
  } catch (error: unknown) {
    if (error instanceof Error) {
      res.status(500).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Unknown error' });
    }
  }
}

export async function getStationOverviewData(req: Request, res: Response) {
  try {
    // Call the new RPC function directly
    const { data, error } = await freshSupabase.rpc('get_station_hourly_health');

    if (error) {
      logger.error('Error fetching station hourly fetch health data', { error });
      throw new Error('Failed to fetch station hourly fetch health data');
    }
    
    res.status(200).json({
      success: true,
      data: data || []
    });
  } catch (error) {
    logger.error('Error in getStationOverviewData', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch station overview data'
    });
  }
}

export async function getHourlyAverageFetchHealth(req: Request, res: Response) {
  try {
    // Call the new RPC function directly
    const { data, error } = await supabase.rpc('get_hourly_avg_fetch_health');

    if (error) {
      logger.error('Error fetching hourly average fetch health data', { error });
      throw new Error('Failed to fetch hourly average fetch health data');
    }
    
    res.status(200).json({
      success: true,
      data: data || []
    });
  } catch (error) {
    logger.error('Error in getHourlyAverageFetchHealth', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch hourly average fetch health data'
    });
  }
}

export async function getHourlyAverageFetchHealth7d(req: Request, res: Response) {
  try {
    // Call the new RPC function directly
    const { data, error } = await supabase.rpc('get_global_3h_avg_fetch_health_7d');

    if (error) {
      logger.error('Error fetching hourly average fetch health 7d data', { error });
      throw new Error('Failed to fetch hourly average fetch health data');
    }
    
    res.status(200).json({
      success: true,
      data: data || []
    });
  } catch (error) {
    logger.error('Error in getHourlyAverageFetchHealth7d', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch hourly average fetch health data'
    });
  }
}

export async function getStationsTable(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    const tableNameId = Number(req.params.tableNameId);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid station ID' });
    if (Number.isNaN(tableNameId)) return res.status(400).json({ error: 'Invalid table name ID' });
    const data = await stationService.getStationTable(id, tableNameId);
    res.json(data);
  } catch (error: unknown) {
    if (error instanceof Error) {
      res.status(500).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Unknown error' });
    }
  }
}

export async function getStationsTableWithDatetime(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    const tableNameId = Number(req.params.tableNameId);
    const datetime = req.query.datetime as string;
    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid station ID' });
    if (Number.isNaN(tableNameId)) return res.status(400).json({ error: 'Invalid table name ID' });
    if (!datetime) return res.status(400).json({ error: 'Datetime parameter is required' });
    // Validate datetime format
    const parsedDatetime = new Date(datetime);
    if (Number.isNaN(parsedDatetime.getTime())) {
      return res.status(400).json({ error: 'Invalid datetime format. Expected ISO string.' });
    }
    const data = await stationService.getStationTableWithDatetime(id, tableNameId, parsedDatetime);
    res.json(data);
  } catch (error: unknown) {
    if (error instanceof Error) {
      res.status(500).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Unknown error' });
    }
  }
}

// New datetime-enabled table functions
export async function getPublicTableWithDatetime(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    const datetime = req.query.datetime as string;
    
    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid station ID' });
    if (!datetime) return res.status(400).json({ error: 'Datetime parameter is required' });
    
    // Validate datetime format
    const parsedDatetime = new Date(datetime);
    if (Number.isNaN(parsedDatetime.getTime())) {
      return res.status(400).json({ error: 'Invalid datetime format. Expected ISO string.' });
    }
    
    const data = await stationService.getPublicTableWithDatetime(id, parsedDatetime);
    res.json(data);
  } catch (error: unknown) {
    if (error instanceof Error) {
      res.status(500).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Unknown error' });
    }
  }
}

export async function getStatusTableWithDatetime(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    const datetime = req.query.datetime as string;

    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid station ID' });
    if (!datetime) return res.status(400).json({ error: 'Datetime parameter is required' });
    
    // Validate datetime format
    const parsedDatetime = new Date(datetime);
    if (Number.isNaN(parsedDatetime.getTime())) {
      return res.status(400).json({ error: 'Invalid datetime format. Expected ISO string.' });
    }
    
    const data = await stationService.getStatusTableWithDatetime(id, parsedDatetime);
    res.json(data);
  } catch (error: unknown) {
    if (error instanceof Error) {
      res.status(500).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Unknown error' });
    }
  }
}

export async function getMeasurementsTableWithDatetime(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    const datetime = req.query.datetime as string;

    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid station ID' });
    if (!datetime) return res.status(400).json({ error: 'Datetime parameter is required' });
    
    // Validate datetime format
    const parsedDatetime = new Date(datetime);
    if (Number.isNaN(parsedDatetime.getTime())) {
      return res.status(400).json({ error: 'Invalid datetime format. Expected ISO string.' });
    }
    
    const data = await stationService.getMeasurementsTableWithDatetime(id, parsedDatetime);
    res.json(data);
  } catch (error: unknown) {
    if (error instanceof Error) {
      res.status(500).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Unknown error' });
    }
  }
}

export async function getStations(req: Request, res: Response) {
  const stations = await stationService.fetchStations();
  res.json(stations);
}

export async function getFieldNames(req: Request, res: Response) {
  try {
    const fieldNames = await fieldService.fetchFieldNamesFromDb();
    res.json(fieldNames);
  } catch (error: unknown) {
    if (error instanceof Error) {
      res.status(500).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Unknown error' });
    }
  }
}

export async function getStationById(req: Request, res: Response) {
  const station = await stationService.fetchStationById(Number(req.params.id));
  if (!station) return res.status(404).json({ error: 'Not found' });
  res.json(station);
}

export async function getAdvancedStationData(req: Request, res: Response) {
  try {
    logger.info('Advanced station data request received');
    
    // Set cache headers to allow efficient caching since data is refreshed periodically
    res.set({
      'Cache-Control': 'public, max-age=300', // 5 minutes client cache
      'ETag': `"advanced-data-${Date.now()}"` // Simple ETag
    });
    
    // Get data from cache
    const cachedData = advancedStationDataCache.getData();
    
    if (cachedData) {
      logger.info('Advanced station data served from cache successfully');
      res.json(cachedData);
      return;
    }
    
    // No cached data available - return appropriate response
  logger.warn('Advanced station data cache miss - data is being fetched in background');
    res.status(503).json({ 
      error: 'Data not available yet',
      message: 'Advanced station data is being fetched. Please try again in a few moments.',
      retry_after: 30,
      cache_status: advancedStationDataCache.getStatus()
    });
    
  } catch (error) {
    logger.error('Error serving advanced station data', { error });
    res.status(500).json({ 
      error: 'Failed to retrieve advanced station data',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}