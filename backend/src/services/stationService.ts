import { supabase } from '../utils/supabaseClient';
import { logger } from '../utils/logger';
import { createClient } from '@supabase/supabase-js';
import { getFieldNamesCached } from './fieldService';

// Create a dedicated client for RPC calls with explicit service role
const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const rpcClient = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
  global: {
    headers: {
      'Authorization': `Bearer ${supabaseServiceKey}`,
      'apikey': supabaseServiceKey,
      'cache-control': 'no-cache',
    },
  },
});

// Test database connection
async function testDatabaseConnection() {
  try {
    const { error } = await supabase.from('stations').select('id').limit(1);
    if (error) {
  logger.error('Database connection test failed', { error });
      return false;
    }
  logger.info('Database connection test passed');
    return true;
  } catch (err) {
  logger.error('Database connection test error', { error: err });
    return false;
  }
}

export async function getAverageStatus() {
  const { data, error } = await rpcClient.from('station_health_summary').select('*');
  if (error) throw error;
  return data;
}

export async function fetchStationStatus() {
  const { data, error } = await rpcClient.rpc('get_station_hourly_health');
  if (error) throw error;
  return data;
}

export async function fetchStationStatus7d() {
  const { data, error } = await rpcClient.rpc('get_station_hourly_health_7d');
  if (error) throw error;
  return data;
}

// Helper: map RPC key-value rows to human-friendly keys using field_names
export function mapStationRows(data: any[], fieldNames: any[]) {
  // Build lookup map: field_id -> field metadata
  const fieldMapById = new Map<number, any>(
    fieldNames.map((fn: any) => [Number(fn.id), fn])
  );

  // Helper to remove outer quotes safely
  const stripOuterQuotes = (val: any) => {
    if (typeof val !== 'string') return val;
    if (val.length >= 2 && val.startsWith('"') && val.endsWith('"')) {
      return val.slice(1, -1);
    }
    return val;
  };

  // Map each row and clean values
  return (data || []).map((item: any) => {
    const fieldId = Number(item.field_id);
    const fieldMeta = fieldMapById.get(fieldId);

    const cleanValue = stripOuterQuotes(item.value);

    if (fieldMeta) {
      return {
        station_id: item.station_id,
        table_name: item.table_name_id,
        key: fieldMeta.name,
        value: cleanValue,
        station_timestamp: item.station_timestamp,
      };
    }

    return {
      ...item,
      value: cleanValue,
      key_id: fieldId,
    };
  });
}

export async function getStationTable(id: number, tableNameId: number) {
  try {
    const { data, error } = await rpcClient.rpc('get_station_data_kv', {
      _station_id: id,
      _table_name_id: tableNameId
    });

    const fieldNames = await getFieldNamesCached();

    if (error) {
      logger.error('Error fetching station table', { stationId: id, tableNameId, error });
      throw error;
    }

    if (!data || !fieldNames) return [];

    // Reuse mapping helper to map rows -> friendly keys
    return mapStationRows(data, fieldNames);

  } catch (err) {
    logger.error('Failed to fetch station table', { stationId: id, tableNameId, error: err });
    return [];
  }
}


export async function getStationTableWithDatetime(id:number, tableNameId:number, datetime:Date){
  try {
    logger.info('Fetching station table window', {
      stationId: id,
      tableNameId,
      endTime: datetime.toISOString(),
    });
    const dateTime = new Date(datetime.getTime() - 1 * 60 * 60 * 1000);
    
    const { data, error } = await rpcClient.rpc('get_station_data_kv_by_time', { 
      _station_id: id, 
      _table_name_id: tableNameId,
      _start_time: dateTime.toISOString(),
      _end_time: datetime.toISOString()
    });

    if (error) {
      logger.error('Error fetching station table window', {
        stationId: id,
        tableNameId,
        startTime: dateTime.toISOString(),
        endTime: datetime.toISOString(),
        error,
      });
      throw error;
    }

    logger.info('Fetched station table window', {
      stationId: id,
      tableNameId,
      startTime: dateTime.toISOString(),
      endTime: datetime.toISOString(),
      records: data?.length ?? 0,
    });
    
    // If we have field name metadata, map rows to friendly keys
    try {
      const fieldNames = await getFieldNamesCached();
      if (fieldNames && Array.isArray(fieldNames) && fieldNames.length > 0) {
        return mapStationRows(data ?? [], fieldNames);
      }
    } catch (e) {
      logger.warn('Failed to fetch field names for mapping in getStationTableWithDatetime', { error: e });
    }

    return data || [];
  } catch (err) {
    logger.error('Failed to fetch station table window', {
      stationId: id,
      tableNameId,
      endTime: datetime.toISOString(),
      error: err,
    });
    return [];
  }
}

export async function fetchStations() {
  const { data, error } = await rpcClient.from('stations').select('*').order('id', { ascending: true });
  if (error) throw error;
  return data;
}

export async function fetchStationById(id: number) {
  const { data, error } = await rpcClient.from('stations').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

// Helper function to convert key-value array to object
function keyValueArrayToObject(keyValueArray: any[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (const item of keyValueArray) {
    result[item.key] = item.value;
  }
  return result;
}

// Comprehensive function to fetch all combined data for all stations
export async function fetchAdvancedStationData() {
  try {
    logger.info('Starting fetchAdvancedStationData');

    // Test database connection first
    const connectionOk = await testDatabaseConnection();
    if (!connectionOk) {
      throw new Error('Database connection failed');
    }

    // Fetch all basic data
  const stations = await fetchStations();
  logger.info('Fetched stations count', { count: stations.length });

    // Fetch status metadata (small set) first
    const [stationStatuses, avgStatuses, stationStatuses7d ] = await Promise.all([
      fetchStationStatus(),
      getAverageStatus(),
      fetchStationStatus7d()
    ]);
    logger.info('Fetched status data', {
      stationStatuses: stationStatuses.length,
      avgStatuses: avgStatuses.length,
      stationStatuses7d: stationStatuses7d.length
    });

    // Concurrency control: limit number of stations processed in parallel
    // to avoid exhausting the Supabase/PostgREST connection pool.
  const concurrencyLimit = Number.parseInt(process.env.ADVANCED_FETCH_CONCURRENCY || '5', 10) || 5;
  logger.info('Processing stations in batches', { concurrency: concurrencyLimit });

    const advancedData: any[] = [];

    // Helper: process a single station (keeps the original logic)
    async function processStation(station: any) {
      try {
        // Fetch key-value data for each table (parallel for this station only)
        const [publicData, statusData, measurementsData] = await Promise.all([
          getStationTable(station.id, 1).catch(() => []),
          getStationTable(station.id, 2).catch(() => []),
          getStationTable(station.id, 3).catch(() => [])
        ]);

        // Debug logging for first station
        if (station.id === stations[0]?.id) {
          logger.info('Station data counts snapshot', {
            stationId: station.id,
            publicData: publicData.length,
            statusData: statusData.length,
            measurementsData: measurementsData.length
          });

          if (publicData.length > 0) {
            logger.info('Sample public data', {
              stationId: station.id,
              sample: publicData.slice(0, 2)
            });
          }
        }

        // Find corresponding status data
        const hourlyStatus = stationStatuses.find((s: any) => s._station_id === station.id);
        const hourlyStatus7d = stationStatuses7d.find((s: any) => s._station_id === station.id);
        const avgStatus = avgStatuses.find((s: any) => s.station_id === station.id);
        

        return {
          // Basic station info
          id: station.id,
          label: station.label,
          label_id: station.label_id,
          label_name: station.label_name,
          label_type: station.label_type,
          latitude: station.latitude,
          longitude: station.longitude,
          altitude: station.altitude,
          county: station.county,
          ip_modem_http: station.ip_modem_http,
          ip_modem_https: station.ip_modem_https,
          ip_datalogger_pakbus: station.ip_datalogger_pakbus,
          ip_datalogger_http: station.ip_datalogger_http,
          sms_number: station.sms_number,

          // Status data
          avg_fetch_health_7d: avgStatus?.avg_network_health_7d || 0,
          avg_fetch_health_24h: avgStatus?.avg_network_health_24h || 0,
          hourly_status: hourlyStatus?.hourly_network_health || [],
          hourly_data_status: hourlyStatus?.hourly_data_health || [],
          hourly_timestamps: hourlyStatus?.hour_bucket_local || [],
          hourly_status_7d: hourlyStatus7d?.hourly_network_health || [],
          hourly_data_status_7d: hourlyStatus7d?.hourly_data_health || [],
          hourly_timestamps_7d: hourlyStatus7d?.hour_bucket_local || [],
          avg_data_health_7d: avgStatus?.avg_data_health_7d || 0,
          avg_data_health_24h: avgStatus?.avg_data_health_24h || 0,

          // Convert key-value arrays to objects
          public_data: keyValueArrayToObject(publicData),
          public_timestamp: publicData[0]?.station_timestamp,
          status_data: keyValueArrayToObject(statusData),
          status_timestamp: statusData[0]?.station_timestamp,
          measurements_data: keyValueArrayToObject(measurementsData),
          measurements_timestamp: measurementsData[0]?.station_timestamp,

          // Metadata
          last_updated: new Date().toISOString(),
          total_measurements: measurementsData.length
        };
      } catch (error) {
  logger.error('Error fetching data for station', { stationId: station.id, error });

        // Return basic station data even if table data fails
        return {
          id: station.id,
          label: station.label,
          label_id: station.label_id,
          label_name: station.label_name,
          label_type: station.label_type,
          latitude: station.latitude,
          longitude: station.longitude,
          altitude: station.altitude,
          county: station.county,
          ip: station.ip,
          sms_number: station.sms_number,
          avg_fetch_health_7d: 0,
          avg_data_health_7d: 0,
          avg_fetch_health_24h: 0,
          avg_data_health_24h: 0,
          hourly_status: [],
          public_data: {},
          status_data: {},
          measurements_data: {},
          last_updated: new Date().toISOString(),
          total_measurements: 0
        };
      }
    }

    // Process stations in batches to limit concurrent RPC calls
    for (let i = 0; i < stations.length; i += concurrencyLimit) {
      const chunk = stations.slice(i, i + concurrencyLimit);
      const chunkResults = await Promise.all(chunk.map(processStation));
      advancedData.push(...chunkResults);
      logger.info('Processed station batch', {
        startIndex: i + 1,
        endIndex: Math.min(i + concurrencyLimit, stations.length)
      });
    }

  // Calculate all possible keys for dynamic columns
    const publicKeys = new Set<string>();
    const statusKeys = new Set<string>();
    const measurementKeys = new Set<string>();

    for (const station of advancedData) {
      for (const key of Object.keys(station.public_data)) publicKeys.add(key);
      for (const key of Object.keys(station.status_data)) statusKeys.add(key);
      for (const key of Object.keys(station.measurements_data)) measurementKeys.add(key);
    }

    logger.info('Final aggregated keys', {
      publicKeysCount: publicKeys.size,
      statusKeysCount: statusKeys.size,
      measurementKeysCount: measurementKeys.size
    });

    // Create template objects with all possible keys
    const publicTemplate: Record<string, string> = {};
    const statusTemplate: Record<string, string> = {};
    const measurementsTemplate: Record<string, string> = {};

    for (const key of publicKeys) publicTemplate[key] = '';
    for (const key of statusKeys) statusTemplate[key] = '';
    for (const key of measurementKeys) measurementsTemplate[key] = '';

    return {
      stations: advancedData,
      columnStructure: {
        public_data: publicTemplate,
        status_data: statusTemplate,
        measurements_data: measurementsTemplate
      },
      metadata: {
        publicKeys: Array.from(publicKeys).sort((a, b) => a.localeCompare(b)),
        statusKeys: Array.from(statusKeys).sort((a, b) => a.localeCompare(b)),
        measurementKeys: Array.from(measurementKeys).sort((a, b) => a.localeCompare(b)),
        totalStations: advancedData.length,
        generatedAt: new Date().toISOString()
      }
    };
  } catch (error) {
    logger.error('Error fetching advanced station data', { error });
    throw error;
  }
}

// Fetch advanced station data snapshot at a specific datetime
export async function fetchAdvancedStationDataAtDatetime(datetime: Date) {
  try {
    logger.info('Starting fetchAdvancedStationDataAtDatetime', { datetime: datetime.toISOString() });

    const connectionOk = await testDatabaseConnection();
    if (!connectionOk) {
      throw new Error('Database connection failed');
    }

    const stations = await fetchStations();

    // Limit concurrency to avoid overloading DB
    const concurrencyLimit = Number.parseInt(process.env.ADVANCED_FETCH_CONCURRENCY || '5', 10) || 5;
    const advancedData: any[] = [];

    async function processStationAtTime(station: any) {
      try {
        const [publicData, statusData, measurementsData] = await Promise.all([
          getStationTableWithDatetime(station.id, 1, datetime).catch(() => []),
          getStationTableWithDatetime(station.id, 2, datetime).catch(() => []),
          getStationTableWithDatetime(station.id, 3, datetime).catch(() => []),
        ]);

        return {
          id: station.id,
          label: station.label,
          label_id: station.label_id,
          label_name: station.label_name,
          label_type: station.label_type,
          latitude: station.latitude,
          longitude: station.longitude,
          altitude: station.altitude,
          county: station.county,
          ip_modem_http: station.ip_modem_http,
          ip_modem_https: station.ip_modem_https,
          ip_datalogger_pakbus: station.ip_datalogger_pakbus,
          ip_datalogger_http: station.ip_datalogger_http,
          sms_number: station.sms_number,

          // Keep status health static for now (at current time)
          avg_fetch_health_7d: 0,
          avg_fetch_health_24h: 0,
          hourly_status: [],
          hourly_timestamps: [],
          avg_data_health_7d: 0,
          avg_data_health_24h: 0,

          public_data: keyValueArrayToObject(publicData),
          public_timestamp: publicData[0]?.station_timestamp,
          status_data: keyValueArrayToObject(statusData),
          status_timestamp: statusData[0]?.station_timestamp,
          measurements_data: keyValueArrayToObject(measurementsData),
          measurements_timestamp: measurementsData[0]?.station_timestamp,

          last_updated: datetime.toISOString(),
          total_measurements: measurementsData.length,
        };
      } catch (error) {
        logger.error('Error fetching data for station at datetime', { stationId: station.id, datetime: datetime.toISOString(), error });
        return {
          id: station.id,
          label: station.label,
          label_id: station.label_id,
          label_name: station.label_name,
          label_type: station.label_type,
          latitude: station.latitude,
          longitude: station.longitude,
          altitude: station.altitude,
          county: station.county,
          ip_modem_http: station.ip_modem_http,
          ip_modem_https: station.ip_modem_https,
          ip_datalogger_pakbus: station.ip_datalogger_pakbus,
          ip_datalogger_http: station.ip_datalogger_http,
          sms_number: station.sms_number,
          avg_fetch_health_7d: 0,
          avg_data_health_7d: 0,
          avg_fetch_health_24h: 0,
          avg_data_health_24h: 0,
          hourly_status: [],
          public_data: {},
          status_data: {},
          measurements_data: {},
          last_updated: datetime.toISOString(),
          total_measurements: 0,
        };
      }
    }

    for (let i = 0; i < stations.length; i += concurrencyLimit) {
      const chunk = stations.slice(i, i + concurrencyLimit);
      const chunkResults = await Promise.all(chunk.map(processStationAtTime));
      advancedData.push(...chunkResults);
    }

    // Build column templates based on keys present in this snapshot
    const publicKeys = new Set<string>();
    const statusKeys = new Set<string>();
    const measurementKeys = new Set<string>();
    for (const station of advancedData) {
      for (const key of Object.keys(station.public_data)) publicKeys.add(key);
      for (const key of Object.keys(station.status_data)) statusKeys.add(key);
      for (const key of Object.keys(station.measurements_data)) measurementKeys.add(key);
    }

    const publicTemplate: Record<string, string> = {};
    const statusTemplate: Record<string, string> = {};
    const measurementsTemplate: Record<string, string> = {};
    for (const key of publicKeys) publicTemplate[key] = '';
    for (const key of statusKeys) statusTemplate[key] = '';
    for (const key of measurementKeys) measurementsTemplate[key] = '';

    return {
      stations: advancedData,
      columnStructure: {
        public_data: publicTemplate,
        status_data: statusTemplate,
        measurements_data: measurementsTemplate,
      },
      metadata: {
        publicKeys: Array.from(publicKeys).sort((a, b) => a.localeCompare(b)),
        statusKeys: Array.from(statusKeys).sort((a, b) => a.localeCompare(b)),
        measurementKeys: Array.from(measurementKeys).sort((a, b) => a.localeCompare(b)),
        totalStations: advancedData.length,
        generatedAt: datetime.toISOString(),
      },
    };
  } catch (error) {
    logger.error('Error fetching advanced station data at datetime', { error, datetime: datetime.toISOString() });
    throw error;
  }
}