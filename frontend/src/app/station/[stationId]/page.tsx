'use client';
import { useState, useEffect, use } from 'react';
import { fetchStationById, getPublicTable, getStatusTable, getMeasurementsTable, fetchStations, fetchStationOverviewData } from '@/utils/stationHelpers';
import type { CollectorDataKeyValue, StationHourlyData, Station } from '@/types/station';
import OverviewTab from './components/OverviewTab';
import PublicTab from './components/PublicTab';
import StatusTab from './components/StatusTab';
import MeasurementsTab from './components/MeasurementsTab';
import ModemTab from './components/ModemTab';
import PublicLiveTab from './components/PublicLiveTab';
import { useRouter, useSearchParams } from 'next/navigation';
type StationTab = 'overview' | 'public' | 'status' | 'measurements' | 'modem' | 'public-live'
import StationSelector from '@/components/StationSelector';

interface StationPageProps {
  readonly params: Promise<{ stationId: string }>;
}

export default function StationPage(props: StationPageProps) {
  const params = use(props.params);
  const { stationId } = params;
  const stationIdNum = Number(stationId);

  const [station, setStation] = useState<Station | null>(null);
  const [publicData, setPublicData] = useState<CollectorDataKeyValue[]>([]);
  const [statusData, setStatusData] = useState<CollectorDataKeyValue[]>([]);
  const [measurementsData, setMeasurementsData] = useState<CollectorDataKeyValue[]>([]);
  const [hourlyData, setHourlyData] = useState<StationHourlyData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState<StationTab>('overview');

  // Additional state for dropdown
  const [stationsList, setStationsList] = useState<Station[]>([]);
  const router = useRouter();
  const searchParams = useSearchParams();

  // Fetch stations list on mount
  useEffect(() => {
    fetchStations().then((stations) => setStationsList(stations));
  }, []);

  // Fetch station data whenever stationIdNum changes
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const data = await fetchStationById(stationIdNum);
        const publicData = await getPublicTable(stationIdNum);
        const statusData = await getStatusTable(stationIdNum);
        const measurementsData = await getMeasurementsTable(stationIdNum);
        const hourlyData = await fetchStationOverviewData();

        setHourlyData(hourlyData);
        setMeasurementsData(measurementsData);
        setStatusData(statusData);
        setPublicData(publicData);
        setStation(data);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [stationIdNum]);

  const handleStationSelect = (id: number) => {
    // keep the current tab in the URL so when moving between stations the same tab is preserved
    const tab = searchParams?.get('tab') ?? selectedTab ?? 'overview'
    router.push(`/station/${id}?tab=${encodeURIComponent(tab)}`);
  };

  // Sync selected tab from URL when the search params actually change (do NOT
  // run when `selectedTab` state changes). This prevents a race where an
  // optimistic local setSelectedTab (on click) is reverted by the old URL value
  // while router.replace() is still pending — which caused the jitter.
  useEffect(() => {
    const t = searchParams?.get('tab')
    if (!t) return
    // only set if it's one of the allowed tabs
    const allowed = new Set(['overview','public','status','measurements','modem','public-live'])
    if (allowed.has(t)) {
      setSelectedTab(t as StationTab)
    }
  }, [searchParams]);

  // Helper to update tab state and push tab param into the URL
  const setTabAndPush = (tab: 'overview' | 'public' | 'status' | 'measurements' | 'modem' | 'public-live') => {
    setSelectedTab(tab)
    // update URL to preserve tab when navigating away
    router.replace(`/station/${stationIdNum}?tab=${encodeURIComponent(tab)}`)
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#fafbfc', maxWidth: '100%', display: 'flex', justifyContent: 'center', paddingTop: 32, paddingBottom: 32 }}>
        <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 4px 24px #0001', padding: '32px 36px', minWidth: '50%', maxWidth: '100%' }}>
          <div style={{ height: 24, width: 200, backgroundColor: '#e0e0e0', borderRadius: 6, marginBottom: 28, animation: 'pulse 1.5s infinite' }} />
          {(() => {
            const SKELETON_KEYS = [
              'sk-1','sk-2','sk-3','sk-4','sk-5','sk-6','sk-7','sk-8','sk-9','sk-10','sk-11','sk-12','sk-13','sk-14','sk-15'
            ]
            return SKELETON_KEYS.map((k) => (
              <div key={k} style={{ height: 20, width: '100%', backgroundColor: '#e0e0e0', borderRadius: 6, marginBottom: 10, animation: 'pulse 1.5s infinite' }} />
            ))
          })()}

          <style>{`
            @keyframes pulse {
              0% { opacity: 1; }
              50% { opacity: 0.4; }
              100% { opacity: 1; }
            }
          `}</style>
        </div>
      </div>
    );
  }

  if (!station) {
    return <div style={{ padding: 32 }}>Station with ID {stationIdNum} not found.</div>;
  }

  const renderTabContent = () => {
    switch (selectedTab) {
      case 'overview':
        return <OverviewTab station={station} hourlyData={hourlyData} />;
      case 'public':
        return <PublicTab publicData={publicData} />;
      case 'status':
        return <StatusTab statusData={statusData} />;
      case 'measurements':
        return <MeasurementsTab measurementsData={measurementsData} />;
      case 'modem':
        return <ModemTab station={station} />;
      case 'public-live':
        return <PublicLiveTab />;
      default:
        return null;
    }
  };

  return (
    <div className="h-full bg-gray-50 flex flex-col">
      {/* Header Section */}
      <div className="px-6 pt-4 flex-shrink-0">
        <div className="flex items-center justify-between max-w-5xl mx-auto mt-2">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-gray-900">Station {station.label}</h1>
            </div>
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 min-h-0 p-6">
        <div className="w-full h-full max-w-5xl mx-auto">
          {/* Station Selector and Tabs Container */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm mb-6">
            <div className="p-6">
              <label htmlFor="station-selector" className="block text-sm text-gray-500 mb-2">Station</label>
              <StationSelector stations={stationsList} value={station.id} onSelect={handleStationSelect} />

              {/* Tab Navigation */}
              <div className="flex items-center gap-2 mt-4">
                <div className="flex flex-wrap md:flex-nowrap">
                  <button
                    onClick={() => setTabAndPush('overview')}
                    className={`px-4 py-2 text-sm font-semibold transition-all relative w-1/3 md:w-auto ${
                      selectedTab === 'overview'
                        ? 'text-gray-500'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    Overview
                    {selectedTab === 'overview' && (
                      <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-8 h-0.5 bg-gray-500"></div>
                    )}
                  </button>
                  <button
                    onClick={() => setTabAndPush('public')}
                    className={`px-4 py-2 text-sm font-semibold transition-all relative w-1/3 md:w-auto ${
                      selectedTab === 'public'
                        ? 'text-gray-500'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    Public
                    {selectedTab === 'public' && (
                      <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-8 h-0.5 bg-gray-500"></div>
                    )}
                  </button>
                  <button
                    onClick={() => setTabAndPush('status')}
                    className={`px-4 py-2 text-sm font-semibold transition-all relative w-1/3 md:w-auto ${
                      selectedTab === 'status'
                        ? 'text-gray-500'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    Status
                    {selectedTab === 'status' && (
                      <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-8 h-0.5 bg-gray-500"></div>
                    )}
                  </button>
                  <button
                    onClick={() => setTabAndPush('measurements')}
                    className={`px-4 py-2 text-sm font-semibold transition-all relative w-1/3 md:w-auto ${
                      selectedTab === 'measurements'
                        ? 'text-gray-500'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    Measurements
                    {selectedTab === 'measurements' && (
                      <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-8 h-0.5 bg-gray-500"></div>
                    )}
                  </button>
                  <button
                    onClick={() => setTabAndPush('modem')}
                    className={`px-4 py-2 text-sm font-semibold transition-all relative w-1/3 md:w-auto ${
                      selectedTab === 'modem'
                        ? 'text-gray-500'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    Modem
                    {selectedTab === 'modem' && (
                      <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-8 h-0.5 bg-gray-500"></div>
                    )}
                  </button>
                  <button
                    onClick={() => setTabAndPush('public-live')}
                    className={`px-4 py-2 text-sm font-semibold transition-all relative w-1/3 md:w-auto ${
                      selectedTab === 'public-live'
                        ? 'text-gray-500'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    Public LIVE
                    {selectedTab === 'public-live' && (
                      <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-8 h-0.5 bg-gray-500"></div>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Content Container */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm h-full flex flex-col overflow-hidden">
            {/* Tab content */}
            <div className="flex-1 p-6 overflow-y-auto">
              {renderTabContent()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
