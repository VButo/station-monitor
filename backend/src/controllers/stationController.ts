import { Request, Response } from 'express';
import * as stationService from '../services/stationService';
import { advancedStationDataCache } from '../services/cacheService';

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

export async function getStatusTable(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid station ID' });
    const data = await stationService.getStatusTable(id);
    res.json(data);
  } catch (error: unknown) {
    if (error instanceof Error) {
      res.status(500).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Unknown error' });
    }
  }
}

export async function getPublicTable(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid station ID' });
    const data = await stationService.getPublicTable(id);
    res.json(data);
  } catch (error: unknown) {
    if (error instanceof Error) {
      res.status(500).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Unknown error' });
    }
  }
}

export async function getMeasurementsTable(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid station ID' });
    const data = await stationService.getMeasurementsTable(id);
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
    
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid station ID' });
    if (!datetime) return res.status(400).json({ error: 'Datetime parameter is required' });
    
    // Validate datetime format
    const parsedDatetime = new Date(datetime);
    if (isNaN(parsedDatetime.getTime())) {
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
    
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid station ID' });
    if (!datetime) return res.status(400).json({ error: 'Datetime parameter is required' });
    
    // Validate datetime format
    const parsedDatetime = new Date(datetime);
    if (isNaN(parsedDatetime.getTime())) {
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
    
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid station ID' });
    if (!datetime) return res.status(400).json({ error: 'Datetime parameter is required' });
    
    // Validate datetime format
    const parsedDatetime = new Date(datetime);
    if (isNaN(parsedDatetime.getTime())) {
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

export async function getStationById(req: Request, res: Response) {
  const station = await stationService.fetchStationById(Number(req.params.id));
  if (!station) return res.status(404).json({ error: 'Not found' });
  res.json(station);
}

export async function getAdvancedStationData(req: Request, res: Response) {
  try {
    console.log('Advanced station data request received - serving from cache only');
    
    // Set cache headers to allow efficient caching since data is refreshed periodically
    res.set({
      'Cache-Control': 'public, max-age=300', // 5 minutes client cache
      'ETag': `"advanced-data-${Date.now()}"` // Simple ETag
    });
    
    // Get data from cache
    const cachedData = advancedStationDataCache.getData();
    
    if (cachedData) {
      console.log('Advanced station data served from cache successfully');
      res.json(cachedData);
      return;
    }
    
    // No cached data available - return appropriate response
    console.log('No cached data available - data is being fetched in background');
    res.status(503).json({ 
      error: 'Data not available yet',
      message: 'Advanced station data is being fetched. Please try again in a few moments.',
      retry_after: 30,
      cache_status: advancedStationDataCache.getStatus()
    });
    
  } catch (error) {
    console.error('Error serving advanced station data:', error);
    res.status(500).json({ 
      error: 'Failed to retrieve advanced station data',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}