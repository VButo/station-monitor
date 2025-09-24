'use client';
import { useState, useEffect, use } from 'react';
import { fetchStationById, getPublicTable, getStatusTable, getMeasurementsTable, fetchStations, fetchStationStatus } from '@/utils/stationHelpers';
import type { CollectorDataKeyValue, HourStatus, Station } from '@/types/station';
import OverviewTab from './components/OverviewTab';
import PublicTab from './components/PublicTab';
import StatusTab from './components/StatusTab';
import MeasurementsTab from './components/MeasurementsTab';
import { useRouter } from 'next/navigation';

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
  const [hourlyData, setHourlyData] = useState<HourStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState<'overview' | 'public' | 'status' | 'measurements'>('overview');

  // Additional state for search
  const [stationsList, setStationsList] = useState<Station[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredStations, setFilteredStations] = useState<Station[]>([]);
  const router = useRouter();

  // Fetch stations list on mount
  useEffect(() => {
    fetchStations().then((stations) => setStationsList(stations));
  }, []);

  // Filter stations based on search term
  useEffect(() => {
    const filtered = stationsList.filter((s) =>
      s.label.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredStations(filtered);
  }, [searchTerm, stationsList]);

  // Fetch station data whenever stationIdNum changes
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const data = await fetchStationById(stationIdNum);
        const publicData = await getPublicTable(stationIdNum);
        const statusData = await getStatusTable(stationIdNum);
        const measurementsData = await getMeasurementsTable(stationIdNum);
        const hourlyData = await fetchStationStatus();

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
    setSearchTerm('');
    setSelectedTab('overview'); // optional reset
    router.push(`/station/${id}`);
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#fafbfc', maxWidth: '100%', display: 'flex', justifyContent: 'center', paddingTop: 32, paddingBottom: 32 }}>
        <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 4px 24px #0001', padding: '32px 36px', minWidth: '50%', maxWidth: '100%' }}>
          <div style={{ height: 24, width: 200, backgroundColor: '#e0e0e0', borderRadius: 6, marginBottom: 28, animation: 'pulse 1.5s infinite' }} />
          {[...Array(15)].map((_, i) => (
            <div key={i} style={{ height: 20, width: '100%', backgroundColor: '#e0e0e0', borderRadius: 6, marginBottom: 10, animation: 'pulse 1.5s infinite' }} />
          ))}

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
      default:
        return null;
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#fafbfc', maxWidth: '100%', display: 'flex', justifyContent: 'center', paddingTop: 32, paddingBottom: 32 }}>
      <div
        id="station-container"
        style={{ background: '#fff', borderRadius: 16, boxShadow: '0 4px 24px #0001', padding: '32px 36px' }}
      >
        <h2 style={{ fontWeight: 700, fontSize: 20, color: '#315284', marginBottom: 8 }}>
          Station: {station.label}
        </h2>

        {/* Search input */}
        <div style={{ marginBottom: 20, position: 'relative' }}>
          <input
            type="text"
            placeholder="Search stations..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px',
              color: '#8593a5',
              borderRadius: 6,
              border: '1px solid #ccc',
              fontSize: 16,
            }}
          />

          {searchTerm && filteredStations.length > 0 && (
            <ul
              style={{
                position: 'absolute',
                width: '100%',
                maxHeight: 200,
                overflowY: 'auto',
                background: 'white',
                border: '1px solid #ccc',
                borderRadius: 6,
                marginTop: 4,
                zIndex: 1000,
                listStyle: 'none',
                padding: 0,
              }}
            >
              {filteredStations.slice(0, 10).map((s) => (
                <button
                  key={s.id}
                  onClick={() => handleStationSelect(s.id)}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    background: 'none',
                    border: 'none',
                    padding: '8px 12px',
                    cursor: 'pointer',
                    color: '#364153',
                    borderBottom: '1px solid #eee',
                    fontSize: 16,
                  }}
                  tabIndex={0}
                  aria-label={`Select station ${s.label}`}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      handleStationSelect(s.id);
                    }
                  }}
                >
                  {s.label}
                </button>
              ))}
            </ul>
          )}
        </div>

        {/* Tabs */}
        <div
          style={{
            display: 'flex',
            gap: 28,
            fontSize: 15,
            color: '#315284',
            borderBottom: '2px solid #f0f3f9',
            marginBottom: 16,
            cursor: 'pointer',
          }}
        >
          <button
            type="button"
            onClick={() => setSelectedTab('overview')}
            style={{
              padding: '8px 0',
              borderBottom: selectedTab === 'overview' ? '2.5px solid #257cff' : 'none',
              color: selectedTab === 'overview' ? '#257cff' : '#315284',
              fontWeight: selectedTab === 'overview' ? 600 : 400,
              userSelect: 'none',
              background: 'none',
              borderTop: 'none',
              borderLeft: 'none',
              borderRight: 'none',
              cursor: 'pointer',
            }}
            tabIndex={0}
            aria-pressed={selectedTab === 'overview'}
          >
            Overview
          </button>
          <button
            type="button"
            onClick={() => setSelectedTab('public')}
            style={{
              padding: '8px 0',
              borderBottom: selectedTab === 'public' ? '2.5px solid #257cff' : 'none',
              color: selectedTab === 'public' ? '#257cff' : '#315284',
              fontWeight: selectedTab === 'public' ? 600 : 400,
              userSelect: 'none',
              background: 'none',
              borderTop: 'none',
              borderLeft: 'none',
              borderRight: 'none',
              cursor: 'pointer',
            }}
            tabIndex={0}
            aria-pressed={selectedTab === 'public'}
          >
            Public
          </button>
          <button
            type="button"
            onClick={() => setSelectedTab('status')}
            style={{
              padding: '8px 0',
              borderBottom: selectedTab === 'status' ? '2.5px solid #257cff' : 'none',
              color: selectedTab === 'status' ? '#257cff' : '#315284',
              fontWeight: selectedTab === 'status' ? 600 : 400,
              userSelect: 'none',
              background: 'none',
              borderTop: 'none',
              borderLeft: 'none',
              borderRight: 'none',
              cursor: 'pointer',
            }}
            tabIndex={0}
            aria-pressed={selectedTab === 'status'}
          >
            Status
          </button>
          <button
            type="button"
            onClick={() => setSelectedTab('measurements')}
            style={{
              padding: '8px 0',
              borderBottom: selectedTab === 'measurements' ? '2.5px solid #257cff' : 'none',
              color: selectedTab === 'measurements' ? '#257cff' : '#315284',
              fontWeight: selectedTab === 'measurements' ? 600 : 400,
              userSelect: 'none',
              background: 'none',
              borderTop: 'none',
              borderLeft: 'none',
              borderRight: 'none',
              cursor: 'pointer',
            }}
            tabIndex={0}
            aria-pressed={selectedTab === 'measurements'}
          >
            Measurements
          </button>
        </div>

        {/* Tab content */}
        {renderTabContent()}
      </div>
      <style>{`
        #station-container {
          width: 50%;
        }
        @media (max-width: 1500px) {
          #station-container {
            width: 60%;
          }
        }
        @media (max-width: 1250px) {
          #station-container {
            width: 70%;
          }
        }
        @media (max-width: 1000px) {
          #station-container {
            width: 90%;
          }
        }
        @media (max-width: 700px) {
          #station-container {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
}
