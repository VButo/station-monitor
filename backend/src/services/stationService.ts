import { supabase } from '../utils/supabaseClient';
import { createClient } from '@supabase/supabase-js';

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
      console.error('Database connection test failed:', error);
      return false;
    }
    console.log('Database connection test passed');
    return true;
  } catch (err) {
    console.error('Database connection test error:', err);
    return false;
  }
}

export async function getAverageStatus() {
  const { data, error } = await supabase.from('station_health_summary').select('*');
  if (error) throw error;
  return data;
}

export async function fetchStationStatus() {
  const { data, error } = await supabase.rpc('get_station_hourly_health');
  if (error) throw error;
  return data;
}

export async function getStatusTable(id: number) {
  try {
    console.log(`Attempting to fetch status table for station ${id}`);
    const { data, error } = await rpcClient.rpc('get_collector_data_kv_status', { _station_id: id });
    
    if (error) {
      console.error(`Error fetching status table for station ${id}:`, error);
      console.error('Error details:', JSON.stringify(error, null, 2));
      throw error;
    }
    
    console.log(`Status table for station ${id}: ${data?.length || 0} records`);
    return data || [];
  } catch (err) {
    console.error(`Failed to fetch status table for station ${id}:`, err);
    return [];
  }
}

export async function getPublicTable(id: number) {
  try {
    console.log(`Attempting to fetch public table for station ${id}`);
    const { data, error } = await rpcClient.rpc('get_collector_data_kv_public', { _station_id: id });
    
    if (error) {
      console.error(`Error fetching public table for station ${id}:`, error);
      console.error('Error details:', JSON.stringify(error, null, 2));
      throw error;
    }
    
    console.log(`Public table for station ${id}: ${data?.length || 0} records`);
    return data || [];
  } catch (err) {
    console.error(`Failed to fetch public table for station ${id}:`, err);
    return [];
  }
}

export async function getMeasurementsTable(id: number) {
  try {
    console.log(`Attempting to fetch measurements table for station ${id}`);
    const { data, error } = await rpcClient.rpc('get_collector_data_kv_measurements', { _station_id: id });
    
    if (error) {
      console.error(`Error fetching measurements table for station ${id}:`, error);
      console.error('Error details:', JSON.stringify(error, null, 2));
      throw error;
    }
    
    console.log(`Measurements table for station ${id}: ${data?.length || 0} records`);
    return data || [];
  } catch (err) {
    console.error(`Failed to fetch measurements table for station ${id}:`, err);
    return [];
  }
}

// New datetime-enabled table functions
export async function getPublicTableWithDatetime(id: number, datetime: Date) {
  try {
    console.log(`Attempting to fetch public table for station ${id} at ${datetime.toISOString()}`);
    
    const dateTime = new Date(datetime.getTime() - 1 * 60 * 60 * 1000);
    
    const { data, error } = await rpcClient.rpc('get_collector_data_kv_public_datetime', { 
      _station_id: id, 
      _datetime: dateTime.toISOString()
    });
    
    if (error) {
      console.error(`Error fetching public table with datetime for station ${id}:`, error);
      console.error('Error details:', JSON.stringify(error, null, 2));
      throw error;
    }
    
    console.log(`Public table with datetime for station ${id}: ${data?.length || 0} records`);
    return data || [];
  } catch (err) {
    console.error(`Failed to fetch public table with datetime for station ${id}:`, err);
    return [];
  }
}

export async function getStatusTableWithDatetime(id: number, datetime: Date) {
  try {
    console.log(`Attempting to fetch status table for station ${id} at ${datetime.toISOString()}`);

    const dateTime = new Date(datetime.getTime() - 1 * 60 * 60 * 1000);
    
    const { data, error } = await rpcClient.rpc('get_collector_data_kv_status_datetime', { 
      _station_id: id, 
      _datetime: dateTime.toISOString()
    });
    
    if (error) {
      console.error(`Error fetching status table with datetime for station ${id}:`, error);
      console.error('Error details:', JSON.stringify(error, null, 2));
      throw error;
    }
    console.log(data);
    console.log(`Status table with datetime for station ${id}: ${data?.length || 0} records`);
    return data || [];
  } catch (err) {
    console.error(`Failed to fetch status table with datetime for station ${id}:`, err);
    return [];
  }
}

export async function getMeasurementsTableWithDatetime(id: number, datetime: Date) {
  try {
    console.log(`Attempting to fetch measurements table for station ${id} at ${datetime.toISOString()}`);
    
    // Calculate start datetime (10 minutes before the provided datetime)
    const dateTime = new Date(datetime.getTime() - 1 * 60 * 60 * 1000);

    const { data, error } = await rpcClient.rpc('get_collector_data_kv_measurements_datetime', { 
      _station_id: id, 
      _datetime: dateTime.toISOString()
    });
    if (error) {
      console.error(`Error fetching measurements table with datetime for station ${id}:`, error);
      console.error('Error details:', JSON.stringify(error, null, 2));
      throw error;
    }
    
    console.log(`Measurements table with datetime for station ${id}: ${data?.length || 0} records`);
    return data || [];
  } catch (err) {
    console.error(`Failed to fetch measurements table with datetime for station ${id}:`, err);
    return [];
  }
}

export async function fetchStations() {
  const { data, error } = await supabase.from('stations').select('*');
  if (error) throw error;
  return data;
}

export async function fetchStationById(id: number) {
  const { data, error } = await supabase.from('stations').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

// Helper function to convert key-value array to object
function keyValueArrayToObject(keyValueArray: any[]): Record<string, string> {
  const result: Record<string, string> = {};
  keyValueArray.forEach(item => {
    result[item.key] = item.value;
  });
  return result;
}

// Comprehensive function to fetch all combined data for all stations
export async function fetchAdvancedStationData() {
  try {
    console.log('Starting fetchAdvancedStationData...');
    
    // Test database connection first
    const connectionOk = await testDatabaseConnection();
    if (!connectionOk) {
      throw new Error('Database connection failed');
    }
    
    // Fetch all basic data
    const stations = await fetchStations();
    console.log('Fetched stations count:', stations.length);
    
    // Fetch status data  
    const [stationStatuses, avgStatuses] = await Promise.all([
      fetchStationStatus(),
      getAverageStatus()
    ]);
    console.log('Fetched status data:', {
      stationStatuses: stationStatuses.length,
      avgStatuses: avgStatuses.length
    });
    
    // Fetch all table data for all stations
    const advancedData = await Promise.all(
      stations.map(async (station) => {
        try {
          // Fetch key-value data for each table
          const [publicData, statusData, measurementsData] = await Promise.all([
            getPublicTable(station.id).catch(() => []),
            getStatusTable(station.id).catch(() => []),
            getMeasurementsTable(station.id).catch(() => [])
          ]);

          // Debug logging
          if (station.id === stations[0]?.id) { // Log for first station only
            console.log(`Station ${station.id} data counts:`, {
              publicData: publicData.length,
              statusData: statusData.length,
              measurementsData: measurementsData.length
            });
            
            if (publicData.length > 0) {
              console.log('Sample public data:', publicData.slice(0, 2));
            }
          }

          // Find corresponding status data
          const hourlyStatus = stationStatuses.find((s: any) => s.station_id === station.id);
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
            ip: station.ip,
            sms_number: station.sms_number,
            
            // Status data
            avg_fetch_health_7d: avgStatus?.avg_fetch_health_7d || 0,
            avg_fetch_health_24h: avgStatus?.avg_fetch_health_24h || 0,
            hourly_status: hourlyStatus?.hourly_avg_array || [],
            hourly_timestamps: hourlyStatus?.hour_bucket_local || [],
            avg_data_health_7d: avgStatus?.avg_data_health_7d || 0,
            avg_data_health_24h: avgStatus?.avg_data_health_24h || 0,
            
            // Convert key-value arrays to objects
            public_data: keyValueArrayToObject(publicData),
            public_timestamp: publicData[0].station_timestamp,
            status_data: keyValueArrayToObject(statusData),
            status_timestamp: statusData[0]?.station_timestamp,
            measurements_data: keyValueArrayToObject(measurementsData),
            measurements_timestamp: measurementsData[0]?.station_timestamp,

            // Metadata
            last_updated: new Date().toISOString(),
            total_measurements: measurementsData.length
          };
        } catch (error) {
          console.error(`Error fetching data for station ${station.id}:`, error);
          
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
      })
    );

    // Calculate all possible keys for dynamic columns
    const publicKeys = new Set<string>();
    const statusKeys = new Set<string>();
    const measurementKeys = new Set<string>();

    advancedData.forEach(station => {
      Object.keys(station.public_data).forEach(key => publicKeys.add(key));
      Object.keys(station.status_data).forEach(key => statusKeys.add(key));
      Object.keys(station.measurements_data).forEach(key => measurementKeys.add(key));
    });

    console.log('Final aggregated keys:', {
      publicKeysCount: publicKeys.size,
      statusKeysCount: statusKeys.size,
      measurementKeysCount: measurementKeys.size
    });

    // Create template objects with all possible keys
    const publicTemplate: Record<string, string> = {};
    const statusTemplate: Record<string, string> = {};
    const measurementsTemplate: Record<string, string> = {};

    publicKeys.forEach(key => publicTemplate[key] = '');
    statusKeys.forEach(key => statusTemplate[key] = '');
    measurementKeys.forEach(key => measurementsTemplate[key] = '');

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
    console.error('Error fetching advanced station data:', error);
    throw error;
  }
}