import type { Station, HourStatus, AvgStatus, CollectorDataKeyValue, AdvancedStationData, StationHourlyData, HourlyAvgFetchHealth } from '@/types/station'
import api from './api';

export async function fetchStations(): Promise<Station[]> {
  const res = await api.get<Station[]>('/stations');
  return res.data;
}

export async function fetchStationStatus(): Promise<HourStatus[]> {
  const res = await api.get<HourStatus[]>(`/stations/station-status`);
  return res.data;
}

export async function fetchStationOverviewData(): Promise<StationHourlyData[]> {
  const res = await api.get<{ success: boolean; data: StationHourlyData[] }>(`/stations/station-overview`);
  return res.data.data;
}

export async function fetchHourlyAvgFetchHealth(): Promise<HourlyAvgFetchHealth[]> {
  const res = await api.get<{ success: boolean; data: HourlyAvgFetchHealth[] }>(`/stations/hourly-average-fetch-health`);
  return res.data.data;
}

export async function fetchHourlyAvgFetchHealth7d(): Promise<HourlyAvgFetchHealth[]> {
  const res = await api.get<{ success: boolean; data: HourlyAvgFetchHealth[] }>(`/stations/hourly-average-fetch-health-7d`);
  return res.data.data;
}

export async function fetchStationById(id: number): Promise<Station | null> {
  const res = await api.get<Station>(`/stations/${id}`);
  return res.data;
}

export async function getAverageStatus(): Promise<AvgStatus[]> {
  const res = await api.get<AvgStatus[]>(`/stations/average-status`);
  return res.data;
}

export async function getPublicTable(id: number): Promise<CollectorDataKeyValue[]> {
  const res = await api.get<CollectorDataKeyValue[]>(`/stations/public-table/${id}`);
  return res.data;
}

export async function getStatusTable(id: number): Promise<CollectorDataKeyValue[]> {
  const res = await api.get<CollectorDataKeyValue[]>(`/stations/status-table/${id}`);
  return res.data;
}

export async function getMeasurementsTable(id: number): Promise<CollectorDataKeyValue[]> {
  const res = await api.get<CollectorDataKeyValue[]>(`/stations/measurements-table/${id}`);
  return res.data;
}

// Report functions with datetime parameter
export async function getPublicTableWithDatetime(id: number, datetime: Date): Promise<CollectorDataKeyValue[]> {
  const res = await api.get<CollectorDataKeyValue[]>(`/stations/public-table-datetime/${id}`, {
    params: { datetime: datetime.toISOString() }
  });
  return res.data;
}

export async function getStatusTableWithDatetime(id: number, datetime: Date): Promise<CollectorDataKeyValue[]> {
  const res = await api.get<CollectorDataKeyValue[]>(`/stations/status-table-datetime/${id}`, {
    params: { datetime: datetime.toISOString() }
  });
  return res.data;
}

export async function getMeasurementsTableWithDatetime(id: number, datetime: Date): Promise<CollectorDataKeyValue[]> {
  const res = await api.get<CollectorDataKeyValue[]>(`/stations/measurements-table-datetime/${id}`, {
    params: { datetime: datetime.toISOString() }
  });
  return res.data;
}

// Function to fetch all combined data for all stations
export async function fetchAdvancedStationData(): Promise<AdvancedStationData[]> {
  try {
    const res = await api.get<{
      stations: AdvancedStationData[], 
      metadata: {
        publicKeys: string[];
        statusKeys: string[];
        measurementKeys: string[];
        totalStations: number;
        generatedAt: string;
      }
    }>('/stations/advanced-table');
    return res.data.stations;
  } catch (error) {
    console.error('Error fetching advanced station data from backend:', error);
    throw error;
  }
}

// Helper function to get all possible keys from the new backend response
export async function getAllPossibleKeys(): Promise<{
  publicKeys: string[];
  statusKeys: string[];
  measurementKeys: string[];
}> {
  try {
    const res = await api.get<{stations: AdvancedStationData[], metadata: {
      publicKeys: string[];
      statusKeys: string[];
      measurementKeys: string[];
    }}>('/stations/advanced-table');
    
    return {
      publicKeys: res.data.metadata.publicKeys,
      statusKeys: res.data.metadata.statusKeys,
      measurementKeys: res.data.metadata.measurementKeys
    };
  } catch (error) {
    console.error('Error fetching keys from backend:', error);
    // Fallback to empty arrays if backend fails
    return {
      publicKeys: [],
      statusKeys: [],
      measurementKeys: []
    };
  }
}