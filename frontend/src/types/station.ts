export interface Station {
  id: number
  label: string
  label_id: string
  label_name: string
  label_type: string
  latitude?: number
  longitude?: number
  altitude?: number
  county?: string
  ip_modem_http: string
  ip_modem_https: string
  ip_datalogger_pakbus: string
  ip_datalogger_http: string
  sms_number?: string
  collect_enabled: boolean
  settings?: JSON
}

export interface CollectorData {
  id: number
  collection_id: number
  station_id: number
  table_name: string
  server_timestamp: string
  station_timestamp: string
  record_number: number
  response_code: number
  response_time: number
  response_length: number
  raw_data?: JSON
  data?: JSON
}
export interface AvgStatus {
  station_id: number
  avg_data_health_24h: number
  avg_data_health_7d: number
  avg_network_health_7d: number
  avg_network_health_24h: number
}
export interface HourStatus {
  station_id: number
  hourly_avg_array: number[],
  hour_bucket_local: string[]
}

export interface StationHourlyData {
  _station_id: number
  hourly_network_health: number[]
  hourly_data_health: number[]
  hour_bucket_local: string[]
}

// New shape returned by the DB RPCs get_hourly_avg_health_24h / get_hourly_avg_health_7d
export interface HourlyAvgHealth {
  hourly_data_health: number[]
  hourly_network_health: number[]
  hourly_avg_online_count: number[]
  hourly_avg_offline_count: number[]
  hour_labels: string[]
}

export interface CollectorDataKeyValue {
  station_id: number
  table_name: number
  key: string
  value: string
  station_timestamp: string
}

// Enhanced interface for the advanced table with all combined data
export interface AdvancedStationData {
  // Basic station info (always visible)
  id: number
  label: string
  label_id: string
  label_name: string
  label_type: string
  latitude?: number
  longitude?: number
  altitude?: number
  ip_modem_http: string
  ip_modem_https: string
  ip_datalogger_pakbus: string
  ip_datalogger_http: string
  sms_number?: string
  county?: string
  
  // Status data (mostly hidden by default)
  avg_fetch_health_7d: number
  avg_fetch_health_24h: number
  hourly_status: number[]
  hourly_data_status: number[]
  hourly_timestamps: string[]
  // 7d status arrays for extended graph
  hourly_status_7d: number[]
  hourly_data_status_7d: number[]
  hourly_timestamps_7d: string[]
  avg_data_health_7d: number
  avg_data_health_24h: number
  
  // Dynamic key-value pairs from public table
  public_data: Record<string, string>
  public_timestamp: string
  // Dynamic key-value pairs from status table  
  status_data: Record<string, string>
  status_timestamp: string
  
  // Dynamic key-value pairs from measurements table
  measurements_data: Record<string, string>
  measurements_timestamp: string
  // Metadata
  last_updated?: string
  total_measurements?: number
}

export interface SmsMessage {
  id: number
  station_id: number
  user_id?: string | null
  number: string
  message: string
  status: string // OUTBOX by default
  time: string
  unread: boolean
  deleted: boolean
  retry_number: number
}