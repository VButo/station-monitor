'use client'
import { useState, useEffect, useMemo, useCallback } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute'
import dynamic from 'next/dynamic';
import { getOverviewData24h, getOverviewData7d, getOnlineData24h, getOnlineData7d } from '@/utils/api';
import { fetchHourlyAvgFetchHealth, fetchHourlyAvgFetchHealth7d } from '@/utils/stationHelpers';
import type { HourlyAvgFetchHealth } from '@/types/station';

// Dynamically import ApexCharts to avoid SSR issues
const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });

// Types for overview data
interface OverviewData {
  station_id: number;
  station_online: boolean;
  fetch_health: number; // Online%
  data_health: number;  // Health%
}

interface OnlineData24h {
  station_id: number;
  hourly_online_array: boolean[];
  hourly_health_array: number[];
  hour_bucket_local: string[];
}

interface OnlineData7d {
  station_id: number;
  hourly_online_array: boolean[];
  hourly_health_array: number[];
  hour_bucket_local: string[];
}

type TimePeriod = '24h' | '7d';
type HealthMetric = 'average' | 'min' | 'max';

// Stats card component
const StatsCard = ({ 
  title, 
  value, 
  color, 
  icon 
}: { 
  title: string; 
  value: string | number; 
  color: string; 
  icon: React.ReactNode;
}) => {
  return (
    <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
          <p className={`text-3xl font-bold ${color}`}>{value}</p>
        </div>
        {(() => {
          let bgColor = 'bg-purple-100';
          if (color.includes('green')) {
            bgColor = 'bg-green-100';
          } else if (color.includes('red')) {
            bgColor = 'bg-red-100';
          } else if (color.includes('blue')) {
            bgColor = 'bg-blue-100';
          } else if (color.includes('yellow')) {
            bgColor = 'bg-yellow-100';
          }
          return (
            <div className={`p-3 rounded-full ${bgColor}`}>
              {icon}
            </div>
          );
        })()}
      </div>
    </div>
  );
};

// Skeleton components for loading states
const SkeletonStatsCard = () => {
  return (
    <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100 animate-pulse">
      <div className="flex items-center justify-between">
        <div>
          <div className="h-4 bg-gray-200 rounded w-24 mb-2"></div>
          <div className="h-8 bg-gray-200 rounded w-16"></div>
        </div>
        <div className="w-12 h-12 bg-gray-200 rounded-full"></div>
      </div>
    </div>
  );
};

const SkeletonChart = () => {
  return (
    <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100 animate-pulse">
      <div className="flex items-center justify-between mb-6">
        <div className="h-6 bg-gray-200 rounded w-48"></div>
        <div className="flex gap-2">
          <div className="h-8 bg-gray-200 rounded w-12"></div>
          <div className="h-8 bg-gray-200 rounded w-12"></div>
        </div>
      </div>
      <div className="h-80 bg-gray-200 rounded"></div>
    </div>
  );
};

const OverviewPageSkeleton = () => {
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="h-8 bg-gray-200 rounded w-48 mb-2 animate-pulse"></div>
        <div className="h-4 bg-gray-200 rounded w-96 animate-pulse"></div>
      </div>

      {/* Stats Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-6 mb-8">
        <SkeletonStatsCard />
        <SkeletonStatsCard />
        <SkeletonStatsCard />
        <SkeletonStatsCard />
        <SkeletonStatsCard />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <SkeletonChart />
        <SkeletonChart />
      </div>
    </div>
  );
};

interface ChartDataPoint {
  timestamp: number;
  online: number;
  offline: number;
}

interface HealthChartDataPoint {
  timestamp: number;
  avgHealth: number;
  minHealth: number;
  maxHealth: number;
}

// Type for ApexCharts tooltip parameters
interface TooltipParams {
  series: number[][];
  seriesIndex: number;
  dataPointIndex: number;
  w: {
    globals: {
      seriesX: number[][];
    };
  };
}

// Process online data for the chart (works for both 24h and 7d)
const processOnlineData = (data: OnlineData24h[] | OnlineData7d[]): ChartDataPoint[] => {
  // (performance marks removed)

  // Aggregate all station states by hour using the new data structure
  const hourlyData = new Map<string, { online: number; offline: number }>();

  for (const station of data) {
    // Each station has hourly_online_array and hour_bucket_local arrays
    for (const [index, isOnline] of station.hourly_online_array.entries()) {
      const hourBucket = station.hour_bucket_local[index];
      if (!hourBucket) continue; // Skip if no corresponding hour bucket

      if (!hourlyData.has(hourBucket)) {
        hourlyData.set(hourBucket, { online: 0, offline: 0 });
      }

      if (isOnline) {
        hourlyData.get(hourBucket)!.online++;
      } else {
        hourlyData.get(hourBucket)!.offline++;
      }
    }
  }

  // Convert to chart format
  const result = [];
  for (const [hourBucket, counts] of hourlyData.entries()) {
    result.push({
      timestamp: new Date(hourBucket).getTime(),
      online: counts.online,
      offline: counts.offline
    });
  }

  result.sort((a, b) => a.timestamp - b.timestamp);
  const sorted = result;

  // (performance marks removed)

  return sorted;
};

// Helper function to aggregate health values by hour (summary statistics to avoid large arrays)
type HealthSummary = { sum: number; count: number; min: number; max: number };

const createEmptySummary = (): HealthSummary => ({ sum: 0, count: 0, min: Infinity, max: -Infinity });

const getOrCreateSummary = (map: Map<string, HealthSummary>, key: string): HealthSummary => {
  let summary = map.get(key);
  if (!summary) {
    summary = createEmptySummary();
    map.set(key, summary);
  }
  return summary;
};

const updateSummaryWithValue = (summary: HealthSummary, rawValue: number | undefined | null = 0) => {
  const value = rawValue ?? 0;
  summary.sum += value;
  summary.count += 1;
  // Preserve previous behavior: treat 0 as "missing" for min/max calculations
  if (value !== 0) {
    summary.min = Math.min(summary.min, value);
    summary.max = Math.max(summary.max, value);
  }
};

const aggregateHealthByHour = (data: OnlineData24h[] | OnlineData7d[]): Map<string, { sum: number; count: number; min: number; max: number }> => {
  const hourlyHealthData = new Map<string, HealthSummary>();

  for (const station of data) {
    const { hourly_health_array, hour_bucket_local } = station;
    for (const [index, healthValue] of hourly_health_array.entries()) {
      const hourBucket = hour_bucket_local[index];
      if (!hourBucket) continue;

      const bucket = getOrCreateSummary(hourlyHealthData, hourBucket);
      updateSummaryWithValue(bucket, healthValue);
    }
  }

  return hourlyHealthData;
};

// Note: we replaced the array-based stats computation with summary stats in aggregateHealthByHour

// Process health data for the chart (works for both 24h and 7d)
const processHealthData = (data: OnlineData24h[] | OnlineData7d[]): HealthChartDataPoint[] => {
  // (performance marks removed)

  const hourlyHealthData = aggregateHealthByHour(data);
  const result = [];
  for (const [hourBucket, summary] of hourlyHealthData.entries()) {
    const avg = summary.count > 0 ? summary.sum / summary.count : 0;
    const min = summary.min === Infinity ? 0 : summary.min;
    const max = summary.max === -Infinity ? 0 : summary.max;

    result.push({
      timestamp: new Date(hourBucket).getTime(),
      avgHealth: Math.round(avg * 100) / 100,
      minHealth: Math.round(min * 100) / 100,
      maxHealth: Math.round(max * 100) / 100
    });
  }

  result.sort((a, b) => a.timestamp - b.timestamp);
  const sorted = result;

  // (performance marks removed)

  return sorted;
};

const OnlineIcon = () => (
  <svg
    aria-hidden="true"
    focusable="false"
    data-prefix="fas"
    data-icon="globe"
    className={"w-8 h-8 text-green-400"}
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 640 640"
    fill="currentColor"
    aria-label="Online Icon"
  >
    <title>Online Icon</title>
    <g transform="translate(64, 64)">
      <path d="M352 256c0 22.2-1.2 43.6-3.3 64H163.3c-2.2-20.4-3.3-41.8-3.3-64s1.2-43.6 3.3-64H348.7c2.2 20.4 3.3 41.8 3.3 64zm28.8-64H503.9c5.3 20.5 8.1 41.9 8.1 64s-2.8 43.5-8.1 64H380.8c2.1-20.6 3.2-42 3.2-64s-1.1-43.4-3.2-64zm112.6-32H376.7c-10-63.9-29.8-117.4-55.3-151.6c78.3 20.7 142 77.5 171.9 151.6zm-149.1 0H167.7c6.1-36.4 15.5-68.6 27-94.7c10.5-23.6 22.2-40.7 33.5-51.5C239.4 3.2 248.7 0 256 0s16.6 3.2 27.8 13.8c11.3 10.8 23 27.9 33.5 51.5c11.6 26 20.9 58.2 27 94.7zm-209 0H18.6C48.6 85.9 112.2 29.1 190.6 8.4C165.1 42.6 145.3 96.1 135.3 160zM8.1 192H131.2c-2.1 20.6-3.2 42-3.2 64s1.1 43.4 3.2 64H8.1C2.8 299.5 0 278.1 0 256s2.8-43.5 8.1-64zM194.7 446.6c-11.6-26-20.9-58.2-27-94.6H344.3c-6.1 36.4-15.5 68.6-27 94.6c-10.5 23.6-22.2 40.7-33.5 51.5C272.6 508.8 263.3 512 256 512s-16.6-3.2-27.8-13.8c-11.3-10.8-23-27.9-33.5-51.5zM135.3 352c10 63.9 29.8 117.4 55.3 151.6C112.2 482.9 48.6 426.1 18.6 352H135.3zm358.1 0c-30 74.1-93.6 130.9-171.9 151.6c25.5-34.2 45.2-87.7 55.3-151.6H493.4z"/>
    </g>
  </svg>
);

const OfflineIcon = () => (
  <svg
    aria-hidden="true"
    focusable="false"
    data-prefix="fas"
    data-icon="power-off"
    className="w-8 h-8 text-red-400"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 640 640"
    fill="currentColor"
  >
    <title>Offline Icon</title>
    <g transform="translate(64, 64)">
      <path d="M288 32c0-17.7-14.3-32-32-32s-32 14.3-32 32V256c0 17.7 14.3 32 32 32s32-14.3 32-32V32zM143.5 120.6c13.6-11.3 15.4-31.5 4.1-45.1s-31.5-15.4-45.1-4.1C49.7 115.4 16 181.8 16 256c0 132.5 107.5 240 240 240s240-107.5 240-240c0-74.2-33.8-140.6-86.6-184.6c-13.6-11.3-33.8-9.4-45.1 4.1s-9.4 33.8 4.1 45.1c38.9 32.3 63.5 81 63.5 135.4c0 97.2-78.8 176-176 176s-176-78.8-176-176c0-54.4 24.7-103.1 63.5-135.4z" />
    </g>
  </svg>
);

const TotalIcon = () => (
  <svg
    aria-hidden="true"
    focusable="false"
    data-prefix="fas"
    data-icon="server"
    className={"w-8 h-8 text-blue-400"}
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 640 640"
    fill="currentColor"
    aria-label="Server Icon"
  >
    <title>Server Icon</title>
    <g transform="translate(64, 64)">
      <path d="M64 32C28.7 32 0 60.7 0 96v64c0 35.3 28.7 64 64 64H448c35.3 0 64-28.7 64-64V96c0-35.3-28.7-64-64-64H64zm280 72a24 24 0 1 1 0 48 24 24 0 1 1 0-48zm48 24a24 24 0 1 1 48 0 24 24 0 1 1 -48 0zM64 288c-35.3 0-64 28.7-64 64v64c0 35.3 28.7 64 64 64H448c35.3 0 64-28.7 64-64V352c0-35.3-28.7-64-64-64H64zm280 72a24 24 0 1 1 0 48 24 24 0 1 1 0-48zm56 24a24 24 0 1 1 48 0 24 24 0 1 1 -48 0z" />
    </g>
  </svg>
);

const PercentageIcon = () => (
  <svg
    className="w-7 h-7"
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden="true"
  >
    {/* Outer arc */}
    <path
      d="M3.5 10.5a10 10 0 0 1 17 0"
      stroke="#fde047" // Tailwind yellow-300
      strokeWidth={2.5}
      fill="none"
      strokeLinecap="round"
    />
    {/* Middle arc */}
    <path
      d="M6.75 14a6 6 0 0 1 10.5 0"
      stroke="#fad447"
      strokeWidth={2.5}
      fill="none"
      strokeLinecap="round"
    />
    {/* Dot */}
    <circle
      cx={12}
      cy={18}
      r={2}
      fill="#facc15" // Tailwind yellow-400
    />
  </svg>
);

const HealthIcon = () => (
  <svg className="w-6 h-6 text-purple-400" fill="currentColor" viewBox="0 0 20 20">
    <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
  </svg>
);

function OverviewPageContent() {
  const [overviewData, setOverviewData] = useState<OverviewData[]>([]);
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [healthChartData, setHealthChartData] = useState<HealthChartDataPoint[]>([]);
  const [avgFetchData, setAvgFetchData] = useState<HourlyAvgFetchHealth | null>(null);
  const [mountCharts, setMountCharts] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('24h');
  const [selectedHealthMetrics, setSelectedHealthMetrics] = useState<Set<HealthMetric>>(new Set(['average']));

  // Helper to schedule non-urgent work during idle or as a macrotask fallback
  const scheduleIdle = (cb: () => void) => {
    if (globalThis.window === undefined) {
      setTimeout(cb, 0);
      return;
    }
    const win = globalThis.window as unknown as {
      requestIdleCallback?: (cb: () => void, opts?: { timeout?: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    if (win.requestIdleCallback) {
      try { win.requestIdleCallback(cb, { timeout: 500 }); return; } catch { }
    }
    setTimeout(cb, 0);
  };

  const fetchChartData = useCallback(async (period: TimePeriod) => {
    try {
      const onlineData = period === '24h' 
        ? await getOnlineData24h()
        : await getOnlineData7d();
      // Defer the CPU work (processing and state updates) to an idle callback or next macrotask
      scheduleIdle(() => {
        try {
          const processedChartData = processOnlineData(onlineData);
          const processedHealthData = processHealthData(onlineData);

          // Update state from the deferred task
          setChartData(processedChartData);
          setHealthChartData(processedHealthData);
        } catch (e) {
          console.error('Deferred processing failed', e);
        }
      });
    } catch (err) {
      console.error(`Error fetching ${period} data:`, err);
      throw err;
    } finally {
      // (performance marks removed)
    }
  }, [/* scheduleIdle is stable per render here; no deps needed because scheduleIdle is defined inline but safe */]);

  useEffect(() => {
    const fetchData = async () => {
      // (performance marks removed)

      try {
        setLoading(true);
        setError(null);
        
        // Use period-specific overview data
        const overviewPromise = timePeriod === '24h' 
          ? getOverviewData24h()
          : getOverviewData7d();
        
        // Await overview metadata quickly and start heavy chart fetch in background
        const overview = await overviewPromise;
        // Start fetching chart data in background (do not await) so overview can render fast
        fetchChartData(timePeriod).catch(err => console.error('fetchChartData error', err));

        // Defer avg-fetch health network call to idle time so it doesn't block the main fetchData duration
        scheduleIdle(async () => {
          try {
            const avgResp = timePeriod === '7d'
              ? await fetchHourlyAvgFetchHealth7d()
              : await fetchHourlyAvgFetchHealth();

            if (Array.isArray(avgResp)) {
              setAvgFetchData(avgResp[0] ?? null);
            } else {
              setAvgFetchData(avgResp ?? null);
            }
          } catch (e) {
            console.error('Failed to fetch avg fetch health', e);
            setAvgFetchData(null);
          }
        });

        setOverviewData(overview);
      } catch (err) {
        console.error('Error fetching overview data:', err);
        setError('Failed to load overview data');
      } finally {
        // (performance marks removed)

        setLoading(false);
      }
    };

    // Initial data fetch
    fetchData();

    // Set up auto-refresh every 10 minutes (600,000 milliseconds)
    const refreshInterval = setInterval(() => {
      console.log('Auto-refreshing overview data...');
      fetchData();
    }, 10 * 60 * 1000); // 10 minutes

    // Cleanup interval on component unmount or timePeriod change
    return () => {
      clearInterval(refreshInterval);
    };
  }, [timePeriod, fetchChartData]);

  // Separate effect: defer heavy chart mounting until the browser is idle to improve first contentful paint
  useEffect(() => {
    if (globalThis.window === undefined) return;
    const win = globalThis.window as unknown as {
      requestIdleCallback?: (cb: () => void, opts?: { timeout?: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    if (win.requestIdleCallback) {
      const id = win.requestIdleCallback(() => setMountCharts(true), { timeout: 500 });
      return () => { if (win.cancelIdleCallback) win.cancelIdleCallback(id); };
    } else {
      const id = globalThis.window.setTimeout(() => setMountCharts(true), 150);
      return () => clearTimeout(id);
    }
  }, []);

  const handleTimePeriodChange = async (newPeriod: TimePeriod) => {
    if (newPeriod === timePeriod) return;
    
    try {
      setTimePeriod(newPeriod);
      // Chart data will be fetched by useEffect due to timePeriod change
    } catch (err) {
      console.error(`Error changing to ${newPeriod}:`, err);
      setError(`Failed to load ${newPeriod} data`);
    }
  };

  const handleHealthMetricToggle = (metric: HealthMetric) => {
    const newMetrics = new Set(selectedHealthMetrics);
    if (newMetrics.has(metric)) {
      // Don't allow removing the last metric
      if (newMetrics.size > 1) {
        newMetrics.delete(metric);
      }
    } else {
      newMetrics.add(metric);
    }
    setSelectedHealthMetrics(newMetrics);
  };

  // Calculate stats from overview data
  const stats = {
    online: overviewData.filter(station => station.station_online).length,
    offline: overviewData.filter(station => !station.station_online).length,
    total: overviewData.length,
    onlinePercentage: overviewData.length > 0 
      ? Math.round((overviewData.filter(station => station.station_online).length / overviewData.length) * 100)
      : 0,
    avgHealth: overviewData.length > 0
      ? Math.round(overviewData.reduce((sum, station) => sum + station.data_health, 0) / overviewData.length)
      : 0
  };

  // Chart configuration
  const chartSeries = useMemo(() => {

    const series = [
      {
        name: 'Online',
        data: chartData.map(point => ({ x: point.timestamp, y: point.online }))
      },
      {
        name: 'Offline', 
        data: chartData.map(point => ({ x: point.timestamp, y: point.offline }))
      }
    ];

    // (performance marks removed)

    return series;
  }, [chartData]);

  // Health chart configuration (memoized)
  const healthChartSeries = useMemo(() => {
    // (performance marks removed)
    const series: { name: string; data: { x: number; y: number }[] }[] = [];
    if (selectedHealthMetrics.has('average')) {
      series.push({ name: 'Average', data: healthChartData.map(point => ({ x: point.timestamp, y: point.avgHealth })) });
    }
    if (selectedHealthMetrics.has('min')) {
      series.push({ name: 'Minimum', data: healthChartData.map(point => ({ x: point.timestamp, y: point.minHealth })) });
    }
    if (selectedHealthMetrics.has('max')) {
      series.push({ name: 'Maximum', data: healthChartData.map(point => ({ x: point.timestamp, y: point.maxHealth })) });
    }
    // (performance marks removed)

    return series;
  }, [healthChartData, selectedHealthMetrics]);

  // Avg Fetch Health series (from helper)
  const avgFetchSeries = useMemo(() => {
    // (performance marks removed)

    if (!avgFetchData || !Array.isArray(avgFetchData.hourly_avg_fetch_health_array) || !Array.isArray(avgFetchData.hour_bucket_local)) {
      // (performance marks removed)
      return [];
    }

    const arr = avgFetchData.hourly_avg_fetch_health_array;
    const buckets = avgFetchData.hour_bucket_local;
    const min = Math.min(arr.length, buckets.length);
    const series = [{ name: 'Connection Health', data: arr.slice(0, min).map((v, i) => ({ x: new Date(buckets[i]).getTime(), y: Number.isFinite(v) ? v : 0 })) }];

    // (performance marks removed)

    return series;
  }, [avgFetchData]);

  // Note: avgFetchChartOptions is defined after healthChartOptions below

  const chartOptions = {
    chart: {
      type: 'bar' as const,
      height: 300,
      stacked: true,
      zoom: { enabled: false },
      toolbar: { show: false },
      animations: {
        enabled: false,
        easing: 'easeinout' as const,
        speed: 0,
      }
    },
    markers: { size: 0 },
    colors: ['#4ADE80', '#F87171'], // Light green-400 for online, red-400 for offline
    fill: {
      opacity: 1
    },
    stroke: {
      width: 0
    },
    plotOptions: {
      bar: {
        horizontal: false,
        columnWidth: '70%',
        borderRadius: 0
      }
    },
    grid: {
      borderColor: '#e5e7eb',
      strokeDashArray: 0,
      xaxis: { lines: { show: false } },
      yaxis: { lines: { show: true } }
    },
    xaxis: {
      type: 'datetime' as const,
      labels: {
        format: timePeriod === '7d' ? 'MMM dd' : 'HH:mm',
        style: { colors: '#6B7280', fontSize: '12px' }
      },
      axisBorder: { show: false },
      axisTicks: { show: false },
      crosshairs: { show: false },
      tooltip: { enabled: false }
    },
    yaxis: {
      labels: {
        style: { colors: '#6B7280', fontSize: '12px' },
        formatter: (value: number) => Math.round(value).toString()
      }
    },
    tooltip: {
      theme: 'light' as const,
      shared: true,
      intersect: false,
      marker: { show: false },
      x: {
        format: 'MMM dd HH:mm'
      },
      style: {
        fontSize: '12px',
        fontFamily: 'inherit'
      },
      // Custom styling to make text gray-500
      custom: function({ series, seriesIndex, dataPointIndex, w }: TooltipParams) {
        const date = new Date(w.globals.seriesX[seriesIndex][dataPointIndex]);
        const onlineValue = series[0][dataPointIndex] || 0;
        const offlineValue = series[1][dataPointIndex] || 0;
        
        return `
          <div class="bg-white border border-gray-200 rounded-lg shadow-lg p-3" style="font-family: inherit;">
            <div class="text-xs mb-2" style="color: #6B7280;">
              ${date.toLocaleDateString('en-US', { 
                month: 'short', 
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </div>
            <div class="space-y-1">
              <div class="flex items-center gap-2">
                <div class="w-2 h-2 rounded-full" style="background-color: #4ADE80;"></div>
                <span class="text-sm" style="color: #6B7280;">Online: ${onlineValue}</span>
              </div>
              <div class="flex items-center gap-2">
                <div class="w-2 h-2 rounded-full" style="background-color: #F87171;"></div>
                <span class="text-sm" style="color: #6B7280;">Offline: ${offlineValue}</span>
              </div>
            </div>
          </div>
        `;
      }
    },
    legend: {
      position: 'top' as const,
      horizontalAlign: 'right' as const
    },
    dataLabels: { enabled: false }
  };

  // Calculate dynamic Y-axis bounds based on actual data
  const calculateYAxisBounds = () => {
    if (healthChartData.length === 0) {
      return { min: 0, max: 100 };
    }

    const allValues: number[] = [];
    
    // Collect all values from selected metrics
    if (selectedHealthMetrics.has('average')) {
      allValues.push(...healthChartData.map(point => point.avgHealth));
    }
    if (selectedHealthMetrics.has('min')) {
      allValues.push(...healthChartData.map(point => point.minHealth));
    }
    if (selectedHealthMetrics.has('max')) {
      allValues.push(...healthChartData.map(point => point.maxHealth));
    }

    if (allValues.length === 0) {
      return { min: 0, max: 100 };
    }

    const dataMin = Math.min(...allValues);
    const dataMax = Math.max(...allValues);
    
    // Add padding and round to nice intervals
    const range = dataMax - dataMin;
    const padding = Math.max(range * 0.1, 5); // At least 5% padding or 10% of range
    
    // Calculate bounds with nice rounding
    let calculatedMin = Math.max(0, dataMin - padding);
    let calculatedMax = Math.min(100, dataMax + padding);
    
    // Round to nice intervals (5% increments)
    calculatedMin = Math.floor(calculatedMin / 5) * 5;
    calculatedMax = Math.ceil(calculatedMax / 5) * 5;
    
    // Ensure minimum range of 20%
    if (calculatedMax - calculatedMin < 20) {
      const center = (calculatedMax + calculatedMin) / 2;
      calculatedMin = Math.max(0, Math.floor((center - 10) / 5) * 5);
      calculatedMax = Math.min(100, Math.ceil((center + 10) / 5) * 5);
    }
    
    return { min: calculatedMin, max: calculatedMax };
  };

  const yAxisBounds = calculateYAxisBounds();

  // Health chart options
  const healthChartOptions = {
    chart: {
      type: 'area' as const,
      height: 300,
      zoom: { enabled: false },
      toolbar: { show: false },
      animations: {
        enabled: false,
        easing: 'easeinout' as const,
        speed: 0,
      }
    },
    colors: ['#8B5CF6', '#EF4444', '#10B981'], // Purple for average, red for min, green for max
    fill: {
      type: 'solid',
      opacity: 0.15
    },
    stroke: {
      width: 2,
      curve: 'smooth' as const
    },
    markers: { size: 0 },
    grid: {
      borderColor: '#e5e7eb',
      strokeDashArray: 0,
      xaxis: { lines: { show: false } },
      yaxis: { lines: { show: true } }
    },
    xaxis: {
      type: 'datetime' as const,
      labels: {
        format: timePeriod === '7d' ? 'MMM dd' : 'HH:mm',
        style: { colors: '#6B7280', fontSize: '12px' }
      },
      axisBorder: { show: false },
      axisTicks: { show: false },
      crosshairs: { show: false },
      tooltip: { enabled: false }
    },
    yaxis: {
      min: yAxisBounds.min,
      max: yAxisBounds.max,
      labels: {
        style: { colors: '#6B7280', fontSize: '12px' },
        formatter: (value: number) => `${Math.round(value)}%`
      }
    },
    tooltip: {
      theme: 'light' as const,
      shared: true,
      intersect: false,
      marker: { show: false },
      x: {
        format: 'MMM dd HH:mm'
      },
      style: {
        fontSize: '12px',
        fontFamily: 'inherit'
      },
      // Custom styling for health tooltip
      custom: function({ seriesIndex, dataPointIndex, w }: Omit<TooltipParams, 'series'>) {
        const date = new Date(w.globals.seriesX[seriesIndex][dataPointIndex]);
        
        // Get the data point for this timestamp
        const dataPoint = healthChartData[dataPointIndex];
        if (!dataPoint) return '';
        
        let tooltipContent = `
          <div class="bg-white border border-gray-200 rounded-lg shadow-lg p-3" style="font-family: inherit;">
            <div class="text-xs mb-2" style="color: #6B7280;">
              ${date.toLocaleDateString('en-US', { 
                month: 'short', 
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </div>
            <div class="space-y-1">
        `;
        
        // Add each selected metric to the tooltip
        if (selectedHealthMetrics.has('average')) {
          tooltipContent += `
            <div class="flex items-center gap-2">
              <div class="w-2 h-2 rounded-full" style="background-color: #8B5CF6;"></div>
              <span class="text-sm" style="color: #6B7280;">Average: ${dataPoint.avgHealth.toFixed(1)}%</span>
            </div>
          `;
        }
        
        if (selectedHealthMetrics.has('min')) {
          tooltipContent += `
            <div class="flex items-center gap-2">
              <div class="w-2 h-2 rounded-full" style="background-color: #EF4444;"></div>
              <span class="text-sm" style="color: #6B7280;">Minimum: ${dataPoint.minHealth.toFixed(1)}%</span>
            </div>
          `;
        }
        
        if (selectedHealthMetrics.has('max')) {
          tooltipContent += `
            <div class="flex items-center gap-2">
              <div class="w-2 h-2 rounded-full" style="background-color: #10B981;"></div>
              <span class="text-sm" style="color: #6B7280;">Maximum: ${dataPoint.maxHealth.toFixed(1)}%</span>
            </div>
          `;
        }
        
        tooltipContent += `
            </div>
          </div>
        `;
        
        return tooltipContent;
      }
    },
    legend: {
      show: true,
      position: 'top' as const,
      horizontalAlign: 'right' as const
    },
    dataLabels: { enabled: false }
  };

  // Avg Fetch chart options reuse the health chart styling but with a different color
  const avgFetchChartOptions = {
    ...healthChartOptions,
    colors: ['#F59E0B'],
    yaxis: {
      min: 0,
      max: 100,
      labels: {
        style: { colors: '#6B7280', fontSize: '12px' },
        formatter: (value: number) => `${Math.round(value)}%`
      }
  },
  tooltip: {
    theme: 'light' as const,
    shared: true,
    intersect: false,
      marker: { show: false },
      x: { format: 'MMM dd HH:mm' },
      style: { fontSize: '12px', fontFamily: 'inherit' },
      custom: function({ series, seriesIndex, dataPointIndex, w }: TooltipParams) {
        // Build tooltip using the same structure as Data Health tooltip but show only Connection
        const date = new Date(w.globals.seriesX[seriesIndex][dataPointIndex]);
        const maybeValue = series?.[seriesIndex]?.[dataPointIndex];
        const value = maybeValue ?? 0;

        return `
          <div class="bg-white border border-gray-200 rounded-lg shadow-lg p-3" style="font-family: inherit;">
            <div class="text-xs mb-2" style="color: #6B7280;">
              ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </div>
            <div class="space-y-1">
              <div class="flex items-center gap-2">
                <div class="w-2 h-2 rounded-full" style="background-color: #F59E0B;"></div>
                <span class="text-sm" style="color: #6B7280;">Connection: ${Number(value).toFixed(1)}%</span>
              </div>
            </div>
          </div>
        `;
      }
    }
  };


  // Icons for stats cards

  return (
    <div className="h-full bg-gray-50 pt-4">
      <div className="max-w-5xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Network Overview</h1>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-sm text-gray-500">Overview data for the last</span>
            <div className="relative">
              <select
                value={timePeriod}
                onChange={(e) => handleTimePeriodChange(e.target.value as TimePeriod)}
                className="appearance-none bg-gray-50 border border-gray-300 rounded-md px-3 py-1 pr-8 text-sm font-medium text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="24h">24 hours</option>
                <option value="7d">7 days</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                  <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
                </svg>
              </div>
            </div>
          </div>
        </div>

        {(() => {
          let content;
          if (loading) {
            content = <OverviewPageSkeleton />;
          } else if (error) {
            content = (
              <div className="flex items-center justify-center h-96">
                <div className="text-red-500">{error}</div>
                <OverviewPageSkeleton />
              </div>
            );
          } else {
            content = (
              <>
                {/* Stats Cards */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6 mb-8">
                  <StatsCard
                    title="Online"
                    value={stats.online}
                    color="text-green-400"
                    icon={<OnlineIcon />}
                  />
                  <StatsCard
                    title="Offline"
                    value={stats.offline}
                    color="text-red-400"
                    icon={<OfflineIcon />}
                  />
                  <StatsCard
                    title="Total"
                    value={stats.total}
                    color="text-blue-400"
                    icon={<TotalIcon />}
                  />
                  <StatsCard
                    title="Online"
                    value={`${stats.onlinePercentage}%`}
                    color="text-yellow-400"
                    icon={<PercentageIcon />}
                  />
                  <StatsCard
                    title="Health"
                    value={`${stats.avgHealth}%`}
                    color="text-purple-400"
                    icon={<HealthIcon />}
                  />
                </div>

                {/* Online Chart */}
                <div className="bg-white rounded-lg shadow p-6 mb-8">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg font-semibold text-gray-900">Station Online Count</h2>
                  </div>
                  {mountCharts ? (
                    <Chart
                      options={chartOptions}
                      series={chartSeries}
                      type="bar"
                      height={300}
                    />
                  ) : (
                    <div className="h-72 flex items-center justify-center text-gray-500">Loading chart...</div>
                  )}
                </div>

                {/* Avg Fetch Health Chart */}
                <div className="bg-white rounded-lg shadow p-6 mb-8">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg font-semibold text-gray-900">Connection Health</h2>
                  </div>
                  {(() => {
                    if (!mountCharts) {
                      return <div className="h-72 flex items-center justify-center text-gray-500">Loading chart...</div>;
                    }
                    if (avgFetchSeries.length === 0) {
                      return <div className="h-72 flex items-center justify-center text-gray-500">No connection data</div>;
                    }
                    return (
                      <Chart
                        options={avgFetchChartOptions}
                        series={avgFetchSeries}
                        type="area"
                        height={300}
                      />
                    );
                  })()}
                </div>

                {/* Health Chart */}
                <div className="bg-white rounded-lg shadow p-6">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg font-semibold text-gray-900">Data Health</h2>
                    <div className="flex items-center gap-4">
                      <div className="relative">
                        <div className="flex flex-wrap gap-2">
                          {(['average', 'min', 'max'] as HealthMetric[]).map(metric => (
                            <button
                              key={metric}
                              onClick={() => handleHealthMetricToggle(metric)}
                              className={`px-3 py-1 text-xs font-medium rounded-full border transition-colors ${
                                selectedHealthMetrics.has(metric)
                                  ? 'bg-purple-100 border-purple-300 text-purple-700'
                                  : 'bg-gray-100 border-gray-300 text-gray-600 hover:bg-gray-200'
                              }`}
                            >
                              {metric.charAt(0).toUpperCase() + metric.slice(1)}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                  {mountCharts ? (
                    <Chart
                      options={healthChartOptions}
                      series={healthChartSeries}
                      type="area"
                      height={300}
                    />
                  ) : (
                    <div className="h-72 flex items-center justify-center text-gray-500">Loading chart...</div>
                  )}
                </div>
              </>
            );
          }
          return content;
        })()}
      </div>
    </div>
  );
}

export default function OverviewPage() {
  return (
    <ProtectedRoute>
      <OverviewPageContent />
    </ProtectedRoute>
  );
}
