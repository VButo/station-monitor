export interface Station {
  id: number
  label: string
  label_id: string
  label_name: string
  label_type: string
  latitude?: number
  longitude?: number
  altitude?: number
  ip: string
  modem_http_port: number
  modem_https_port: number
  datalogger_pakbus_port: number
  datalogger_http_port: number
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
  avg_fetch_health_7d: number
  avg_fetch_health_24h: number
}
export interface HourStatus {
  station_id: number
  hourly_avg_array: number[],
  hour_bucket_local: string[]
}

export interface CollectorDataKeyValue {
  station_id: number
  collection_id: number
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
  ip: string
  sms_number?: string
  
  // Status data (mostly hidden by default)
  avg_fetch_health_7d: number
  avg_fetch_health_24h: number
  hourly_status: number[]
  hourly_timestamps: string[]
  avg_data_health_7d: number
  avg_data_health_24h: number
  
  // Dynamic key-value pairs from public table
  public_data: Record<string, string>
  
  // Dynamic key-value pairs from status table  
  status_data: Record<string, string>
  
  // Dynamic key-value pairs from measurements table
  measurements_data: Record<string, string>
  
  // Metadata
  last_updated?: string
  total_measurements?: number
}