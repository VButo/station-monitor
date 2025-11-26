// Axios instance for frontend API calls to backend
import axios from 'axios';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api',
  withCredentials: true, // Send cookies with requests
});

// Response interceptor to handle authentication errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Only redirect if we're not already on the login page
      if (globalThis.window !== undefined && globalThis.window.location.pathname !== '/login') {
        console.warn('API: Authentication failed, redirecting to login');
        globalThis.window.location.href = '/login';
      } else if (globalThis.window !== undefined) {
        console.warn('API: Authentication failed on login page, ignoring redirect');
      }
    }
    // Ensure the rejection reason is always an Error
    let rejectionReason: Error;
    if (error instanceof Error) {
      rejectionReason = error;
    } else if (typeof error === 'string') {
      rejectionReason = new Error(error);
    } else {
      rejectionReason = new Error(JSON.stringify(error));
    }
    return Promise.reject(rejectionReason);
  }
);

export default api;

// Response Time API functions
export interface ResponseTimeData {
  collection_timestamp: string;
  response_time: number;
}

export const getResponseTimes = async (): Promise<ResponseTimeData[]> => {
  const response = await api.get<{ data: ResponseTimeData[] }>('/response-times');
  console.log("Fetched response times:", response.data.data);
  return response.data.data;
};

// Overview API functions
export interface OverviewData {
  station_id: number;
  online: boolean;
  network_health: number; // Connection health %
  data_health: number;    // Data health %
}

// Aggregated hourly arrays returned by overview RPCs (single-row aggregate)
export interface OnlineData {
  hourly_data_health: number[];
  hourly_data_health_min: number[];
  hourly_data_health_max: number[];
  hourly_network_health: number[];
  hourly_avg_online_count: number[];
  hour_labels: string[];
}

export const getOverviewData24h = async (): Promise<OverviewData[]> => {
  const response = await api.get<{ data: OverviewData[] }>('/overview-data-24h');
  return response.data.data;
};

export const getOverviewData7d = async (): Promise<OverviewData[]> => {
  const response = await api.get<{ data: OverviewData[] }>('/overview-data-7d');
  return response.data.data;
};

export const getOnlineData24h = async (): Promise<OnlineData[]> => {
  const response = await api.get<{ data: OnlineData[] }>('/online-data-24h');
  return response.data.data;
};

export const getOnlineData7d = async (): Promise<OnlineData[]> => {
  const response = await api.get<{ data: OnlineData[] }>('/online-data-7d');
  return response.data.data;
};
