import React from 'react';
import type { Station } from '@/types/station';
import TimelineCell from '@/components/TimelineCell';

interface OverviewTabProps {
  station: Station;
  hourlyData: { 
    station_id: number; 
    hourly_avg_array: number[];
    hour_bucket_local?: string[]; // timestamps array 
  }[];
}

const OverviewTab: React.FC<OverviewTabProps> = ({ station, hourlyData }) => {
  // Find station health data with 24 values or 'Error' otherwise
  const stationHealth = hourlyData.find(d => d.station_id === station.id);

  const chartData =
    stationHealth?.hourly_avg_array?.length === 24 ? stationHealth.hourly_avg_array : ('Error' as const);

  // Extract timestamps if they exist and length matches
  const timestamps = 
    stationHealth?.hour_bucket_local?.length === 24 
      ? stationHealth.hour_bucket_local 
      : undefined;

  const combinedFields = [
    { label: 'ID', value: station.id },
    { label: 'Label', value: station.label },
    { label: 'Label ID', value: station.label_id },
    { label: 'Label Name', value: station.label_name },
    { label: 'Label Type', value: station.label_type },
    { label: 'Latitude', value: station.latitude },
    { label: 'Longitude', value: station.longitude },
    { label: 'Altitude', value: station.altitude },
    { label: 'IP Address', value: station.ip },
    { label: 'Modem HTTP', value: station.modem_http_port ? station.ip + ':' + station.modem_http_port : 'N/A' },
    { label: 'Modem HTTPS', value: station.modem_https_port ? station.ip + ':' + station.modem_https_port : 'N/A' },
    { label: 'Datalogger Pakbus', value: station.datalogger_pakbus_port ? station.ip + ':' + station.datalogger_pakbus_port : 'N/A' },
    { label: 'Datalogger HTTP', value: station.datalogger_http_port ? station.ip + ':' + station.datalogger_http_port : 'N/A' },
    { label: 'SMS Number', value: station.sms_number },
    { label: 'Collect Enabled', value: station.collect_enabled ? 'Yes' : 'No' },
  ];

  return (
    <div>
      {/* Chart container */}
      <div
        style={{
          marginBottom: '24px',
          padding: '12px',
          border: '1px solid #e0e0e0',
          borderRadius: '8px',
          backgroundColor: '#fafafa',
          maxWidth: '100%',
          overflowX: 'auto', // allow horizontal scroll on small screens
          boxShadow: '0 0 8px rgba(0,0,0,0.05)',
        }}
      >
        <TimelineCell value={chartData} timestamps={timestamps} BarWidth={34} maxBarHeight={100}/>
        <div style={{ textAlign: 'center', marginTop: '8px', color: '#555', fontSize: '14px' }}>
          Station Health (Last 24 Hours)
        </div>
      </div>

      {/* Key-value pairs as before */}
      {combinedFields.map(({ label, value }) => {
        const isLinkField = ['Modem HTTP', 'Modem HTTPS', 'Datalogger HTTP'].includes(label);
        return (
          <div className="kv-row" key={label}>
            <span className="kv-key">{label}</span>
            {isLinkField && typeof value === 'string' && value !== 'N/A' ? (
              <a
                href={value === `${station.ip}:443` ? `https://${value}` : `http://${value}`}
                target="_blank"
                rel="noopener noreferrer"
                className="kv-value kv-link text-gray-500 text-decoration-underline hover:text-blue-700"
              >
                {value === `${station.ip}:443` ? `https://${value}` : `http://${value}`}
              </a>
            ) : (
              <span className="kv-value">{value}</span>
            )}
          </div>
        );
      })}
      <style>{`
        .kv-row {
          display: flex;
          justify-content: space-between;
          border-bottom: 1px solid #eef1f4;
          padding: 12px 0;
          font-size: 16px;
        }
        .kv-key {
          font-weight: 500;
          color: #8593a5;
          width: 50%;
        }
        .kv-value {
          color: #253d61;
          font-family: monospace, monospace;
          letter-spacing: 0.3px;
          font-weight: 400;
          width: 50%;
          text-align: left;
          word-break: break-all;
        }
        .kv-link {
          color: #253d61;
          text-decoration: underline;
        }
        @media (max-width: 700px) {
          .kv-row {
            flex-direction: column;
            align-items: flex-start;
            gap: 4px;
          }
          .kv-key,
          .kv-value {
            width: 100%;
            text-align: left;
          }
        }
      `}</style>
    </div>
  );
};

export default OverviewTab;
