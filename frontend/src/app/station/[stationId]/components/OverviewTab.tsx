 'use client'

import React, { useMemo } from 'react';
import dynamic from 'next/dynamic';
import type { Station, StationHourlyData } from '@/types/station';

const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });

interface OverviewTabProps {
  station: Station;
  hourlyData: StationHourlyData[];
}

const OverviewTab: React.FC<OverviewTabProps> = ({ station, hourlyData }) => {
  // Find station data
  const stationData = hourlyData.find(d => d.station_id === station.id);
  console.log(stationData);
  // Prepare online chart data (convert boolean array to number array for TimelineCell)
  const onlineChartData =
    stationData?.hourly_online_array?.length === 24 
      ? stationData.hourly_online_array
      : ('Error' as const);

  // Prepare health chart data  
  const healthChartData =
    stationData?.hourly_health_array?.length === 24 
      ? stationData.hourly_health_array 
      : ('Error' as const);

  // Extract timestamps if they exist and length matches
  const timestamps = 
    stationData?.hour_bucket_local?.length === 24 
      ? stationData.hour_bucket_local 
      : undefined;

  // Build ApexCharts series for health and online (use timestamps as x)
  

  const healthSeries = useMemo(() => {
    if (!Array.isArray(healthChartData) || !timestamps) return [];
    return [
      {
        name: 'Health',
        data: healthChartData.map((v, i) => ({ x: new Date(timestamps[i]).getTime(), y: typeof v === 'number' ? v : 0 }))
      }
    ];
  }, [healthChartData, timestamps]);

  

  const onlineSeries = useMemo(() => {
    if (!timestamps) return [];
    if (!Array.isArray(onlineChartData)) return [];

    // Treat onlineChartData as numeric. If values are in 0..1, scale to 0..100.
  const nums = onlineChartData.map(Number);
    const max = Math.max(...nums.map(n => (Number.isFinite(n) ? n : 0)));
    if (max <= 1) {
      return [{ name: 'Online', data: nums.map((v, i) => ({ x: new Date(timestamps[i]).getTime(), y: (Number.isFinite(v) ? v * 100 : 0) })) }];
    }
    return [{ name: 'Online', data: nums.map((v, i) => ({ x: new Date(timestamps[i]).getTime(), y: (Number.isFinite(v) ? v : 0) })) }];
  }, [onlineChartData, timestamps]);

  // Shared simplified chart options similar to overview's Data Health style
  const sharedChartOptions = useMemo(() => ({
    chart: {
      type: 'area' as const,
      height: 220,
      zoom: { enabled: false },
      toolbar: { show: false },
      animations: { enabled: true, easing: 'easeinout' as const, speed: 600 }
    },
    colors: ['#8B5CF6'],
    fill: { type: 'solid', opacity: 0.15 },
    stroke: { width: 2, curve: 'smooth' as const },
    grid: { borderColor: '#e5e7eb', xaxis: { lines: { show: false } }, yaxis: { lines: { show: true } } },
    xaxis: { type: 'datetime' as const, labels: { format: 'HH:mm', style: { colors: '#6B7280', fontSize: '12px' } }, axisBorder: { show: false }, axisTicks: { show: false }, crosshairs: { show: false }, tooltip: { enabled: false } },
    yaxis: { min: 0, max: 100, labels: { style: { colors: '#6B7280', fontSize: '12px' }, formatter: (v: number) => `${Math.round(v)}%` } },
  tooltip: { theme: 'light' as const, shared: true, intersect: false, marker: { show: false }, x: { format: 'MMM dd, yyyy, HH:mm' }, style: { fontSize: '12px', fontFamily: 'inherit' } },
    legend: { show: false },
    dataLabels: { enabled: false }
  }), []);

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
    { label: 'SMS Number', value: station.sms_number ? '+' + station.sms_number : 'N/A' },
    { label: 'Collect Enabled', value: station.collect_enabled ? 'Yes' : 'No' },
  ];

  return (
    <div>
      {/* Charts Container - Side by Side */}
      <div
        style={{
          marginBottom: '24px',
          display: 'flex',
          gap: '16px',
          flexWrap: 'wrap',
        }}
      >
        {/* Online Status Chart */}
        <div
          style={{
            flex: '1',
            minWidth: '300px',
            padding: '12px',
            border: '1px solid #e0e0e0',
            borderRadius: '8px',
            backgroundColor: '#fafafa',
            overflowX: 'auto',
            boxShadow: '0 0 8px rgba(0,0,0,0.05)',
          }}
        >
          <Chart options={{ ...sharedChartOptions, colors: ['#10B981'] }} series={onlineSeries} type="area" height={220} />
          <div className="text-gray-500 text-center mt-2 text-sm">
            Station Online Status (Last 24 Hours)
          </div>
        </div>

        
        {/* Health Status Chart */}
        <div
          style={{
            flex: '1',
            minWidth: '300px',
            padding: '12px',
            border: '1px solid #e0e0e0',
            borderRadius: '8px',
            backgroundColor: '#fafafa',
            overflowX: 'auto',
            boxShadow: '0 0 8px rgba(0,0,0,0.05)',
          }}
        >
          <Chart options={sharedChartOptions} series={healthSeries} type="area" height={220} />
          <div className="text-gray-500 text-center mt-2 text-sm">
            Station Health (Last 24 Hours)
          </div>
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
          width: 200px;
          min-width: 200px;
          padding-right: 24px;
          flex-shrink: 0;
        }
        .kv-value {
          color: #253d61;
          font-family: monospace, monospace;
          letter-spacing: 0.3px;
          font-weight: 400;
          flex: 1;
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
        /* ApexCharts tooltip text color override to match Tailwind text-gray-500 (#6B7280) */
        .apexcharts-tooltip, .apexcharts-tooltip * {
          color: #6B7280 !important;
        }
      `}</style>
    </div>
  );
};

export default OverviewTab;
