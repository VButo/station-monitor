'use client';
import { useState, useEffect } from 'react';
import { fetchStations, getPublicTableWithDatetime, getStatusTableWithDatetime, getMeasurementsTableWithDatetime } from '@/utils/stationHelpers';
import type { CollectorDataKeyValue, Station } from '@/types/station';
import PublicTab from '../station/[stationId]/components/PublicTab';
import StatusTab from '../station/[stationId]/components/StatusTab';
import MeasurementsTab from '../station/[stationId]/components/MeasurementsTab';

export default function ReportPage() {
  const [selectedStation, setSelectedStation] = useState<Station | null>(null);
  const [publicData, setPublicData] = useState<CollectorDataKeyValue[]>([]);
  const [statusData, setStatusData] = useState<CollectorDataKeyValue[]>([]);
  const [measurementsData, setMeasurementsData] = useState<CollectorDataKeyValue[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedTab, setSelectedTab] = useState<'public' | 'status' | 'measurements'>('public');

  // Station search state
  const [stationsList, setStationsList] = useState<Station[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredStations, setFilteredStations] = useState<Station[]>([]);

  // Date and time selection state
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]); // YYYY-MM-DD format
  const [selectedTime, setSelectedTime] = useState(() => {
    // Round current time to nearest 10-minute increment
    const now = new Date();
    const minutes = Math.round(now.getMinutes() / 10) * 10;
    now.setMinutes(minutes, 0, 0); // Set to rounded minutes, zero out seconds and milliseconds
    return now.toTimeString().slice(0, 5); // HH:MM format
  });

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

  // Fetch data for selected station and datetime
  const fetchReportData = async () => {
    if (!selectedStation) return;

    setLoading(true);
    try {
      // Combine date and time for API calls
      const datetime = new Date(`${selectedDate}T${selectedTime}:00`);
      
      // TODO: These API calls will need to be updated to accept datetime parameter
      // For now, using the existing functions - you'll need to modify them for datetime filtering
      const [publicDataResult, statusDataResult, measurementsDataResult] = await Promise.all([
        getPublicTableWithDatetime(selectedStation.id, datetime), // Now uses datetime parameter
        getStatusTableWithDatetime(selectedStation.id, datetime), // Now uses datetime parameter 
        getMeasurementsTableWithDatetime(selectedStation.id, datetime), // Now uses datetime parameter
      ]);

      setPublicData(publicDataResult);
      setStatusData(statusDataResult);
      setMeasurementsData(measurementsDataResult);
    } catch (error) {
      console.error('Error fetching report data:', error);
      // Reset data on error
      setPublicData([]);
      setStatusData([]);
      setMeasurementsData([]);
    } finally {
      setLoading(false);
    }
  };

  const handleStationSelect = (station: Station) => {
    setSelectedStation(station);
    setSearchTerm('');
    setFilteredStations([]);
    // Auto-fetch data when station is selected
    fetchReportData();
  };

  const handleDateTimeChange = () => {
    if (selectedStation) {
      fetchReportData();
    }
  };

  const renderTabContent = () => {
    if (!selectedStation || loading) {
      return (
        <div style={{ padding: '40px 0', textAlign: 'center' }}>
          {loading ? (
            <p style={{ color: '#8593a5' }}>Loading report data...</p>
          ) : (
            <p style={{ color: '#8593a5' }}>Please select a station and date/time to generate a report.</p>
          )}
        </div>
      );
    }

    switch (selectedTab) {
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

  const handlePrintReport = () => {
    // Add print-specific styles and trigger browser print
    const printStyles = `
      @media print {
        body * { visibility: hidden; }
        #report-container, #report-container * { visibility: visible; }
        #report-container { 
          position: absolute; 
          left: 0; 
          top: 0; 
          width: 100% !important;
          margin: 0;
          padding: 20px;
          box-shadow: none;
        }
        .no-print { display: none !important; }
        .page-break { page-break-before: always; }
      }
    `;
    
    // Add print styles to head
    const styleSheet = document.createElement('style');
    styleSheet.textContent = printStyles;
    document.head.appendChild(styleSheet);
    
    // Trigger print
    window.print();
    
    // Clean up
    setTimeout(() => {
      document.head.removeChild(styleSheet);
    }, 1000);
  };

  return (
    <div style={{ minHeight: '100vh', background: '#fafbfc', maxWidth: '100%', display: 'flex', justifyContent: 'center', paddingTop: 32, paddingBottom: 32 }}>
      <div
        id="report-container"
        style={{ background: '#fff', borderRadius: 16, boxShadow: '0 4px 24px #0001', padding: '32px 36px' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <h2 style={{ fontWeight: 700, fontSize: 20, color: '#315284', margin: 0 }}>
            Station Report
            {selectedStation && ` - ${selectedStation.label}`}
          </h2>
          
          {selectedStation && (
            <button
              onClick={handlePrintReport}
              className="no-print"
              style={{
                padding: '8px 16px',
                backgroundColor: '#257cff',
                color: 'white',
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer',
                fontSize: 14,
                fontWeight: 500,
              }}
            >
              Export to PDF
            </button>
          )}
        </div>

        {/* Station Search and DateTime Selection Row */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 20, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          {/* Station Search */}
          <div style={{ flex: 1, minWidth: 200, position: 'relative' }}>
            <label style={{ display: 'block', marginBottom: 4, fontWeight: 500, color: '#315284', fontSize: 14 }}>
              Select Station
            </label>
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
                boxSizing: 'border-box',
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
                  zIndex: 10,
                  listStyle: 'none',
                  margin: 0,
                  padding: 0,
                }}
              >
                {filteredStations.map((station) => (
                  <li
                    key={station.id}
                    onClick={() => handleStationSelect(station)}
                    style={{
                      padding: '10px 15px',
                      cursor: 'pointer',
                      borderBottom: '1px solid #eee',
                      color: '#315284',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f5f5f5')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'white')}
                  >
                    {station.label}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Date Selection */}
          <div style={{ minWidth: 140 }}>
            <label style={{ display: 'block', marginBottom: 4, fontWeight: 500, color: '#315284', fontSize: 14 }}>
              Date
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              style={{
                padding: '8px 12px',
                borderRadius: 6,
                border: '1px solid #ccc',
                fontSize: 14,
                color: '#315284',
              }}
            />
          </div>

          {/* Time Selection */}
          <div style={{ minWidth: 120 }}>
            <label style={{ display: 'block', marginBottom: 4, fontWeight: 500, color: '#315284', fontSize: 14 }}>
              Time
            </label>
            <select
              value={selectedTime}
              onChange={(e) => setSelectedTime(e.target.value)}
              style={{
                padding: '8px 12px',
                borderRadius: 6,
                border: '1px solid #ccc',
                fontSize: 14,
                color: '#315284',
                backgroundColor: 'white',
                width: '100%',
              }}
            >
              {Array.from({ length: 144 }, (_, i) => {
                const totalMinutes = i * 10;
                const hours = Math.floor(totalMinutes / 60);
                const minutes = totalMinutes % 60;
                const timeValue = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
                return (
                  <option key={timeValue} value={timeValue}>
                    {timeValue}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Generate Report Button */}
          <button
            onClick={handleDateTimeChange}
            disabled={!selectedStation || loading}
            className="no-print"
            style={{
              padding: '8px 16px',
              backgroundColor: selectedStation ? '#28a745' : '#ccc',
              color: 'white',
              border: 'none',
              borderRadius: 6,
              cursor: selectedStation ? 'pointer' : 'not-allowed',
              fontSize: 14,
              fontWeight: 500,
              minWidth: 100,
            }}
          >
            {loading ? 'Loading...' : 'Generate'}
          </button>
        </div>

        {/* Display selected station and datetime for print */}
        {selectedStation && (
          <div style={{ marginBottom: 20, padding: 12, backgroundColor: '#f8f9fa', borderRadius: 6 }}>
            <p style={{ margin: 0, fontSize: 14, color: '#315284' }}>
              <strong>Station:</strong> {selectedStation.label} | 
              <strong> Date:</strong> {selectedDate} | 
              <strong> Time:</strong> {selectedTime}
            </p>
          </div>
        )}

        {/* Tab Navigation */}
        {selectedStation && (
          <div style={{ display: 'flex', gap: 36, marginBottom: 16, borderBottom: '1px solid #e2e8f0' }}>
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
              Public Data
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
              Status Data
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
              Measurements Data
            </button>
          </div>
        )}

        {/* Tab content */}
        {renderTabContent()}
      </div>
      
      <style>{`
        #report-container {
          width: 50%;
        }
        @media (max-width: 1500px) {
          #report-container {
            width: 60%;
          }
        }
        @media (max-width: 1250px) {
          #report-container {
            width: 70%;
          }
        }
        @media (max-width: 1000px) {
          #report-container {
            width: 90%;
          }
        }
        @media (max-width: 700px) {
          #report-container {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
}