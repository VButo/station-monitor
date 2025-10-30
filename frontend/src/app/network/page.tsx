'use client'
import { useState, useEffect} from 'react'
import { fetchStations, fetchStationStatus, getAverageStatus } from '@/utils/stationHelpers'
import StationTable, { RowData } from '@/components/StationTable'
import StationList, { StationListData } from '@/components/StationList'
import AdvancedTable from '@/components/AdvancedTable'
import ProtectedRoute from '@/components/ProtectedRoute'
import type { Station } from '@/types/station'
import { useRouter, useSearchParams } from 'next/navigation'

function StationsPageContent() {
  const [stations, setStations] = useState<Station[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'detail' | 'list' | 'advanced'>('list')
  // Removed unused searchTerm state
  
  // Data for table view
  const [tableRowData, setTableRowData] = useState<RowData[]>([])
  
  // Data for list view  
  const [listData, setListData] = useState<StationListData[]>([])
  
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    // helper to find an entry by station_id without using array callbacks
    const findByStationId = <T extends { station_id?: string | number }>(arr: T[] | undefined, stationId: string | number): T | undefined => {
      if (!arr) return undefined
      for (const item of arr) {
        if (item && item.station_id === stationId) return item
      }
      return undefined
    }

    const loadStations = async () => {
      try {
        setLoading(true)
        setError(null)
        
        // Fetch all required data
        const stationsData = await fetchStations()
        const hourlyData = await fetchStationStatus()
        const avgStatusData = await getAverageStatus()
        
        setStations(stationsData)
        
        // Prepare table row data using loops (no nested callbacks)
        const tableData: RowData[] = []
        for (const station of stationsData) {
          const stationHealth = findByStationId(hourlyData, station.id)
          const avgData = findByStationId(avgStatusData, station.id)
          tableData.push({
            id: station.id,
            label_id: station.label_id,
            label_text: station.label_name,
            label_type: station.label_type,
            status: stationHealth?.hourly_avg_array?.length === 24 ? stationHealth.hourly_avg_array : ('Error' as const),
            timestamps: stationHealth?.hour_bucket_local?.length === 24 ? stationHealth.hour_bucket_local : [],
            avg_data_health_24h: avgData?.avg_data_health_24h || null,
            avg_fetch_health_24h: avgData?.avg_fetch_health_24h || 0,
          })
        }
        setTableRowData(tableData)
        
        // Prepare list data using loops (no nested callbacks)
        const listDataArr: StationListData[] = []
        for (const station of stationsData) {
          const avgData = findByStationId(avgStatusData, station.id)
          listDataArr.push({
            id: station.id,
            label: station.label,
            ip: station.ip,
            online: avgData?.avg_fetch_health_24h || 0,
            health: avgData?.avg_data_health_24h || null,
          })
        }
        setListData(listDataArr)
        
      } catch (err) {
        console.error('Error fetching stations:', err)
        setError('Failed to load stations')
      } finally {
        setLoading(false)
      }
    }

    // Initial load
    loadStations()

    // Set up automatic refresh every 10 minutes (600,000 ms)
    const refreshInterval = setInterval(() => {
      console.log('Auto-refreshing station data...')
      loadStations()
    }, 10 * 60 * 1000)

    // Cleanup interval on component unmount
    return () => {
      clearInterval(refreshInterval)
    }
  }, [])

  // Sync viewMode with URL query param 'tab' (kept separate to avoid interfering with data loading)
  useEffect(() => {
    const tab = searchParams?.get('tab')
    if (tab === 'list' || tab === 'detail' || tab === 'advanced') {
      setViewMode(tab)
    }
  }, [searchParams])

  const handleRowClick = (stationId: string) => {
    const tab = viewMode || 'list'
    router.push(`/station/${stationId}?tab=${encodeURIComponent(tab)}`);
  };

  // No searchTerm, so filtered data is just the original data
  const filteredTableData = tableRowData;

  const filteredListData = listData;

  if (error) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Error Loading Stations</h2>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    )
  }
  console.log('filteredStations:', stations);
  return (
    <div className="h-full bg-gray-50 flex flex-col">
      {/* Header Section */}
      <div className="px-6 pt-4 flex-shrink-0">
        <div className="flex items-center justify-between max-w-5xl mx-auto mt-2">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-gray-900">Network Explorer</h1>
            </div>
          </div>
          
          {/* View Mode Toggle */}
          <div className="flex items-center gap-2">
            <div className="flex">
              <button
                onClick={() => {
                  setViewMode('list')
                  router.push(`/network?tab=list`)
                }}
                className={`px-4 py-2 text-sm font-semibold transition-all relative ${
                  viewMode === 'list'
                    ? 'text-gray-500'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                List
                {viewMode === 'list' && (
                  <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-5 h-0.5 bg-gray-500"></div>
                )}
              </button>
              <button
                onClick={() => {
                  setViewMode('detail')
                  router.push(`/network?tab=detail`)
                }}
                className={`px-4 py-2 text-sm font-semibold transition-all relative ${
                  viewMode === 'detail'
                    ? 'text-gray-500'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Detail
                {viewMode === 'detail' && (
                  <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-5 h-0.5 bg-gray-500"></div>
                )}
              </button>
              <button
                onClick={() => {
                  setViewMode('advanced')
                  router.push(`/network?tab=advanced`)
                }}
                className={`px-4 py-2 text-sm font-semibold transition-all relative ${
                  viewMode === 'advanced'
                    ? 'text-gray-500'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Advanced
                {viewMode === 'advanced' && (
                  <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-5 h-0.5 bg-gray-500"></div>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 min-h-0 p-6">
        <div className="w-full h-full">
          {(() => {
            let content;
            if (viewMode === 'detail') {
              if (loading) {
                // Loading skeleton for detail
                content = (
                  <div className="bg-white rounded-lg border border-gray-200 shadow-sm h-full flex flex-col overflow-hidden">
                    <div className="flex-1 divide-y divide-gray-100 overflow-y-auto">
                      {Array.from({ length: 10 }).map((_, index) => {
                        const skeletonKey = `skeleton-row-${Date.now()}-${index}`;
                        return (
                          <div key={skeletonKey} className="px-6 py-4 animate-pulse">
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <div className="h-4 bg-gray-200 rounded w-48 mb-2"></div>
                                <div className="h-3 bg-gray-200 rounded w-32"></div>
                              </div>
                              <div className="ml-6 flex gap-[2px]">
                                {Array.from({ length: 24 }).map((_, i) => (
                                  <div key={`skeleton-bar-${index}-${i}`} className="w-[10px] h-8 bg-gray-200 rounded-sm"></div>
                                ))}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              } else if (stations.length === 0) {
                content = (
                  <div className="bg-white rounded-lg border border-gray-200 shadow-sm h-full flex items-center justify-center">
                    <div className="text-center">
                      <h3 className="text-lg font-medium text-gray-900 mb-2">No stations found</h3>
                    </div>
                  </div>
                );
              } else {
                content = (
                  <StationTable rowData={filteredTableData} onRowClick={handleRowClick} />
                );
              }
            } else if (viewMode === 'list') {
              content = (
                <StationList stationListData={filteredListData} onStationClick={handleRowClick} loading={loading} />
              );
            } else {
              content = (
                <div className="h-full overflow-hidden">
                  <AdvancedTable onRowClick={(stationId) => handleRowClick(stationId.toString())} />
                </div>
              );
            }
            return content;
          })()}
        </div>
      </div>
    </div>
  )
}

export default function StationsPage() {
  return (
    <ProtectedRoute>
      <StationsPageContent />
    </ProtectedRoute>
  );
}

