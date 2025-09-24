'use client'
import { useState, useEffect} from 'react'
import { fetchStations } from '@/utils/stationHelpers'
import StationItem from '@/components/StationItem'
import ProtectedRoute from '@/components/ProtectedRoute'
import type { Station } from '@/types/station'
import { useRouter } from 'next/navigation'

function StationsPageContent() {
  const [stations, setStations] = useState<Station[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    

    const loadStations = async () => {
      try {
        setLoading(true)
        setError(null)
        const stationsData = await fetchStations()
        setStations(stationsData)
      } catch (err) {
        console.error('Error fetching stations:', err)
        setError('Failed to load stations')
      } finally {
        setLoading(false)
      }
    }

    loadStations()
  }, [])

  const handleRowClick = (stationId: string) => {
    router.push(`/station/${stationId}`);
  };

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
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex-shrink-0">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold text-gray-900">Station list</h1>
              <span className="bg-orange-500 text-white text-xs font-medium px-2 py-1 rounded">
                {loading ? '...' : stations.length}
              </span>
            </div>
            <p className="text-sm text-gray-500 mt-1">Real-time monitoring</p>
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 min-h-0 p-6">
        <div className="max-w-5xl mx-auto h-full">
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm h-full flex flex-col overflow-hidden">
            {(() => {
              if (loading) {
                // Loading skeleton
                return (
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
                );
              } else if (stations.length === 0) {
                return (
                  <div className="flex-1 flex items-center justify-center">
                    <div className="text-center">
                      <h3 className="text-lg font-medium text-gray-900 mb-2">No stations found</h3>
                    </div>
                  </div>
                );
              } else {
                return (
                  <div className="flex-1 divide-y divide-gray-100 overflow-y-auto">
                    <StationItem data={stations} onRowClick={handleRowClick} />
                  </div>
                );
              }
            })()}
          </div>
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

