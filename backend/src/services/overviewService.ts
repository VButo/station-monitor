import { createClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger';

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

export interface OverviewData {
  station_id: number;
  station_online: boolean;
  fetch_health: number; // Online%
  data_health: number;  // Health%
}

export interface OnlineData {
  hourly_data_health: number[];
  hourly_data_health_min: number[];
  hourly_data_health_max: number[];
  hourly_network_health: number[];
  hourly_avg_online_count: number[];
  hour_labels: string[];
}


export const getOverviewData24h = async (): Promise<OverviewData[]> => {
  try {
    const { data, error } = await rpcClient.rpc('get_station_overview_24h');

    if (error) {
      logger.error('Error fetching overview data (24h)', { error });
      throw new Error('Failed to fetch overview data for the last 24 hours');
    }

    return data || [];
  } catch (error) {
    logger.error('Error in getOverviewData24h', { error });
    throw error;
  }
};

export const getOverviewData7d = async (): Promise<OverviewData[]> => {
  try {
    const { data, error } = await rpcClient.rpc('get_station_overview_7d');

    if (error) {
      logger.error('Error fetching overview data (7d)', { error });
      throw new Error('Failed to fetch overview data for the last 7 days');
    }

    return data || [];
  } catch (error) {
    logger.error('Error in getOverviewData7d', { error });
    throw error;
  }
};

export const getOnlineData24h = async (): Promise<OnlineData[]> => {
  try {
    const { data, error } = await rpcClient.rpc('get_hourly_avg_health_24h');

    if (error) {
      logger.error('Error fetching 24h online data', { error });
      throw new Error('Failed to fetch 24h online data');
    }

    return data || [];
  } catch (error) {
    logger.error('Error in getOnlineData24h', { error });
    throw error;
  }
};

export const getOnlineData7d = async (): Promise<OnlineData[]> => {
  try {
    const { data, error } = await rpcClient.rpc('get_hourly_avg_health_7d');

    if (error) {
      logger.error('Error fetching 7d online data', { error });
      throw new Error('Failed to fetch 7d online data');
    }

    return data || [];
  } catch (error) {
    logger.error('Error in getOnlineData7d', { error });
    throw error;
  }
};