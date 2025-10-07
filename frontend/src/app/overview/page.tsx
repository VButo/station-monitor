'use client'
import { useState, useEffect } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute'
import dynamic from 'next/dynamic';
import { getOverviewData, getOnlineData24h, getOnlineData7d } from '@/utils/api';

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
        <div className={`p-3 rounded-full ${color.includes('green') ? 'bg-green-100' : 
                                           color.includes('red') ? 'bg-red-100' : 
                                           color.includes('blue') ? 'bg-blue-100' :
                                           color.includes('yellow') ? 'bg-yellow-100' :
                                           'bg-purple-100'}`}>
          {icon}
        </div>
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
  // Aggregate all station states by hour using the new data structure
  const hourlyData = new Map<string, { online: number; offline: number }>();
  
  data.forEach(station => {
    // Each station has hourly_online_array and hour_bucket_local arrays
    station.hourly_online_array.forEach((isOnline, index) => {
      const hourBucket = station.hour_bucket_local[index];
      if (!hourBucket) return; // Skip if no corresponding hour bucket
      
      if (!hourlyData.has(hourBucket)) {
        hourlyData.set(hourBucket, { online: 0, offline: 0 });
      }
      
      if (isOnline) {
        hourlyData.get(hourBucket)!.online++;
      } else {
        hourlyData.get(hourBucket)!.offline++;
      }
    });
  });

  // Convert to chart format
  const result = [];
  for (const [hourBucket, counts] of hourlyData.entries()) {
    result.push({
      timestamp: new Date(hourBucket).getTime(),
      online: counts.online,
      offline: counts.offline
    });
  }
  
  return result.sort((a, b) => a.timestamp - b.timestamp);
};

// Process health data for the chart (works for both 24h and 7d)
const processHealthData = (data: OnlineData24h[] | OnlineData7d[]): HealthChartDataPoint[] => {
  // Aggregate health data by hour using the new data structure
  const hourlyHealthData = new Map<string, { healthValues: number[] }>();
  
  data.forEach(station => {
    // Each station has hourly_health_array and hour_bucket_local arrays
    station.hourly_health_array.forEach((healthValue, index) => {
      const hourBucket = station.hour_bucket_local[index];
      if (!hourBucket) return; // Skip if no corresponding hour bucket
      
      if (!hourlyHealthData.has(hourBucket)) {
        hourlyHealthData.set(hourBucket, { healthValues: [] });
      }
      
      const bucket = hourlyHealthData.get(hourBucket)!;
      // For average: treat null/undefined as 0, for min/max: ignore null values
      if (healthValue !== null && healthValue !== undefined) {
        bucket.healthValues.push(healthValue);
      } else {
        // Only add 0 for average calculation, we'll handle this separately
        bucket.healthValues.push(0);
      }
    });
  });

  // Convert to chart format with average, min, and max health
  const result = [];
  for (const [hourBucket, data] of hourlyHealthData.entries()) {
    const nonNullValues = data.healthValues.filter(val => val !== 0); // For min/max calculation, exclude null-converted-to-0
    
    const avgHealth = data.healthValues.length > 0 ? 
      data.healthValues.reduce((sum, val) => sum + val, 0) / data.healthValues.length : 0;
    
    const minHealth = nonNullValues.length > 0 ? Math.min(...nonNullValues) : 0;
    const maxHealth = nonNullValues.length > 0 ? Math.max(...nonNullValues) : 0;
    
    result.push({
      timestamp: new Date(hourBucket).getTime(),
      avgHealth: Math.round(avgHealth * 100) / 100,
      minHealth: Math.round(minHealth * 100) / 100,
      maxHealth: Math.round(maxHealth * 100) / 100
    });
  }
  
  return result.sort((a, b) => a.timestamp - b.timestamp);
};

function OverviewPageContent() {
  const [overviewData, setOverviewData] = useState<OverviewData[]>([]);
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [healthChartData, setHealthChartData] = useState<HealthChartDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('24h');
  const [selectedHealthMetrics, setSelectedHealthMetrics] = useState<Set<HealthMetric>>(new Set(['average']));

  const fetchChartData = async (period: TimePeriod) => {
    try {
      const onlineData = period === '24h' 
        ? await getOnlineData24h()
        : await getOnlineData7d();
      
      const processedChartData = processOnlineData(onlineData);
      const processedHealthData = processHealthData(onlineData);
      
      setChartData(processedChartData);
      setHealthChartData(processedHealthData);
    } catch (err) {
      console.error(`Error fetching ${period} data:`, err);
      throw err;
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const [overview] = await Promise.all([
          getOverviewData(),
          fetchChartData(timePeriod)
        ]);
        
        setOverviewData(overview);
      } catch (err) {
        console.error('Error fetching overview data:', err);
        setError('Failed to load overview data');
      } finally {
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
  }, [timePeriod]);

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
  const chartSeries = [
    {
      name: 'Online',
      data: chartData.map(point => ({ x: point.timestamp, y: point.online }))
    },
    {
      name: 'Offline', 
      data: chartData.map(point => ({ x: point.timestamp, y: point.offline }))
    }
  ];

  // Health chart configuration
  const healthChartSeries = [];
  
  if (selectedHealthMetrics.has('average')) {
    healthChartSeries.push({
      name: 'Average',
      data: healthChartData.map(point => ({ x: point.timestamp, y: point.avgHealth }))
    });
  }
  
  if (selectedHealthMetrics.has('min')) {
    healthChartSeries.push({
      name: 'Minimum',
      data: healthChartData.map(point => ({ x: point.timestamp, y: point.minHealth }))
    });
  }
  
  if (selectedHealthMetrics.has('max')) {
    healthChartSeries.push({
      name: 'Maximum',
      data: healthChartData.map(point => ({ x: point.timestamp, y: point.maxHealth }))
    });
  }

  const chartOptions = {
    chart: {
      type: 'bar' as const,
      height: 300,
      stacked: true,
      zoom: { enabled: false },
      toolbar: { show: false },
      animations: {
        enabled: true,
        easing: 'easeinout' as const,
        speed: 800,
      }
    },
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
        format: 'HH:mm',
        style: { colors: '#6B7280', fontSize: '12px' }
      },
      axisBorder: { show: false },
      axisTicks: { show: false }
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

  // Health chart options
  const healthChartOptions = {
    chart: {
      type: 'line' as const,
      height: 300,
      zoom: { enabled: false },
      toolbar: { show: false },
      animations: {
        enabled: true,
        easing: 'easeinout' as const,
        speed: 800,
      }
    },
    colors: ['#8B5CF6', '#EF4444', '#10B981'], // Purple for average, red for min, green for max
    fill: {
      opacity: 1
    },
    stroke: {
      width: 3,
      curve: 'smooth' as const
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
        format: 'HH:mm',
        style: { colors: '#6B7280', fontSize: '12px' }
      },
      axisBorder: { show: false },
      axisTicks: { show: false }
    },
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
      position: 'top' as const,
      horizontalAlign: 'right' as const
    },
    dataLabels: { enabled: false }
  };

  // Icons for stats cards
  const OnlineIcon = () => (
    <svg className="w-6 h-6 text-green-400" fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
    </svg>
  );

  const OfflineIcon = () => (
    <svg className="w-6 h-6 text-red-400" fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M13.477 14.89A6 6 0 015.11 6.524l8.367 8.368zm1.414-1.414L6.524 5.11a6 6 0 018.367 8.367zM18 10a8 8 0 11-16 0 8 8 0 0116 0z" clipRule="evenodd" />
    </svg>
  );

  const TotalIcon = () => (
    <svg className="w-6 h-6 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
      <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );

  const PercentageIcon = () => (
    <svg className="w-6 h-6 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
    </svg>
  );

  const HealthIcon = () => (
    <svg className="w-6 h-6 text-purple-400" fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
    </svg>
  );

  return (
    <div className="h-full bg-gray-50 p-6">
      <div className="max-w-5xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Station Overview</h1>
          <p className="text-sm text-gray-500 mt-1">Last 24 hours</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-96">
            <div className="text-gray-500">Loading overview data...</div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-96">
            <div className="text-red-500">{error}</div>
          </div>
        ) : (
          <>
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6 mb-8">
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
                title="% Online"
                value={`${stats.onlinePercentage}%`}
                color="text-yellow-400"
                icon={<PercentageIcon />}
              />
              <StatsCard
                title="% Health"
                value={`${stats.avgHealth}%`}
                color="text-purple-400"
                icon={<HealthIcon />}
              />
            </div>

            {/* Online Chart */}
            <div className="bg-white rounded-lg shadow p-6 mb-8">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Station Online Status</h2>
                <div className="relative">
                  <select
                    value={timePeriod}
                    onChange={(e) => handleTimePeriodChange(e.target.value as TimePeriod)}
                    className="appearance-none bg-gray-50 border border-gray-300 rounded-md px-5 py-1 text-sm font-medium text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="24h">24h</option>
                    <option value="7d">7d</option>
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                    <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                      <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
                    </svg>
                  </div>
                </div>
              </div>
              <Chart
                options={chartOptions}
                series={chartSeries}
                type="bar"
                height={300}
              />
            </div>

            {/* Health Chart */}
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Data Health</h2>
                <div className="flex items-center gap-4">
                  <div className="text-sm text-gray-500">
                    Showing {timePeriod} data
                  </div>
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
              <Chart
                options={healthChartOptions}
                series={healthChartSeries}
                type="line"
                height={300}
              />
            </div>
          </>
        )}
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
