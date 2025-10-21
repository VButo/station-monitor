import { supabase } from '../utils/supabaseClient';

export interface OverviewData {
  station_id: number;
  station_online: boolean;
  fetch_health: number; // Online%
  data_health: number;  // Health%
}

export interface OnlineData24h {
  station_id: number;
  hourly_online_array: boolean[];
  hourly_health_array: number[];
  hour_bucket_local: string[];
}

export interface OnlineData7d {
  station_id: number;
  hourly_online_array: boolean[];
  hourly_health_array: number[];
  hour_bucket_local: string[];
}

export const getOverviewData24h = async (): Promise<OverviewData[]> => {
  try {
    const { data, error } = await supabase.rpc('get_overview_data_24h');

    if (error) {
      console.error('Error fetching overview data:', error);
      throw new Error('Failed to fetch overview data for the last 24 hours');
    }

    return data || [];
  } catch (error) {
    console.error('Error in getOverviewData24h:', error);
    throw error;
  }
};

export const getOverviewData7d = async (): Promise<OverviewData[]> => {
  try {
    const { data, error } = await supabase.rpc('get_overview_data_7d');

    if (error) {
      console.error('Error fetching overview data:', error);
      throw new Error('Failed to fetch overview data for the last 7 days');
    }

    return data || [];
  } catch (error) {
    console.error('Error in getOverviewData7d:', error);
    throw error;
  }
};

export const getOnlineData24h = async (): Promise<OnlineData24h[]> => {
  try {
    const { data, error } = await supabase.rpc('get_online_data_24h');

    if (error) {
      console.error('Error fetching 24h online data:', error);
      throw new Error('Failed to fetch 24h online data');
    }

    return data || [];
  } catch (error) {
    console.error('Error in getOnlineData24h:', error);
    throw error;
  }
};

export const getOnlineData7d = async (): Promise<OnlineData7d[]> => {
  try {
    const { data, error } = await supabase.rpc('get_online_data_7d');

    if (error) {
      console.error('Error fetching 7d online data:', error);
      throw new Error('Failed to fetch 7d online data');
    }

    return data || [];
  } catch (error) {
    console.error('Error in getOnlineData7d:', error);
    throw error;
  }
};