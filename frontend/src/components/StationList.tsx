import React, { useState, useMemo } from 'react';

export interface StationListData {
  id: number;
  label: string;
  ip: string;
  online: number;
  health: number | null;
}

interface StationListProps {
  readonly stationListData: StationListData[];
  readonly onStationClick: (stationId: string) => void;
  readonly loading?: boolean;
}

export default function StationList({ stationListData, onStationClick, loading = false }: StationListProps) {
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Reset function to clear search (StationList doesn't have other filters/sorts)
  const resetList = () => {
    setSearchTerm('');
  };

  const filteredData = useMemo(() => {
    if (!searchTerm.trim()) return stationListData;
    
    const lowercaseSearch = searchTerm.toLowerCase();
    return stationListData.filter((station) =>
      station.label.toLowerCase().includes(lowercaseSearch) ||
      station.ip.toLowerCase().includes(lowercaseSearch)
    );
  }, [stationListData, searchTerm]);

  const totalCount = stationListData.length;
  const filteredCount = filteredData.length;
  const isFiltered = searchTerm.trim().length > 0;
  const getStatusColor = (value: number | null) => {
    if (value === null) return 'text-gray-400';
    if (value >= 90) return 'text-green-600';
    if (value >= 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  if (loading) {
    return (
      <div className="flex flex-col w-full" style={{ height: '100%' }}>
        {/* Search and Row Count - Aligned with Content */}
        <div className="w-full mb-4">
          <div className="max-w-5xl mx-auto">
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
              <div className="flex flex-col gap-4">
                {/* Search and Reset row */}
                <div className="flex items-center gap-3">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      placeholder="Search stations..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 text-gray-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      disabled
                    />
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </div>
                  </div>

                  {/* Reset Button */}
                  <button
                    onClick={resetList}
                    className="text-sm text-gray-500 hover:text-gray-700 underline whitespace-nowrap"
                    disabled
                  >
                    Reset
                  </button>
                </div>

                {/* Station count row */}
                <div className="text-sm text-gray-600">
                  Loading stations...
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Content Container */}
        <div className="flex-1 w-full">
          <div className="max-w-5xl mx-auto">
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden" style={{ height: 'calc(100vh - 320px)' }}>
              <div className="p-4">
                <div className="animate-pulse space-y-4">
                  {[1, 2, 3, 4, 5].map((item) => (
                    <div key={`loading-skeleton-${item}`} className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="h-5 bg-gray-200 rounded w-48 mb-2"></div>
                  <div className="h-4 bg-gray-200 rounded w-32"></div>
                </div>
                <div className="flex space-x-4">
                  <div className="h-5 bg-gray-200 rounded w-16"></div>
                  <div className="h-5 bg-gray-200 rounded w-16"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (filteredData.length === 0 && !loading) {
    return (
      <div className="flex flex-col w-full" style={{ height: '90%' }}>
        {/* Search and Row Count - Aligned with Content */}
        <div className="w-full mb-4">
          <div className="max-w-5xl mx-auto">
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
              <div className="flex flex-col gap-4">
                {/* Search and Reset row */}
                <div className="flex items-center gap-3">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      placeholder="Search stations..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 text-gray-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </div>
                  </div>

                  {/* Reset Button */}
                  <button
                    onClick={resetList}
                    className="text-sm text-gray-500 hover:text-gray-700 underline whitespace-nowrap"
                  >
                    Reset
                  </button>
                </div>

                {/* Station count row */}
                <div className="text-sm text-gray-600">
                  {isFiltered ? (
                    <>Showing {filteredCount} of {totalCount} stations</>
                  ) : (
                    <>{totalCount} stations</>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Content Container */}
        <div className="flex-1 w-full">
          <div className="max-w-5xl mx-auto">
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden" style={{ height: 'calc(100vh - 320px)' }}>
              <div className="h-full flex items-center justify-center">
                <div className="text-center text-gray-500">
                  {isFiltered ? "No stations match your search" : "No stations found"}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full" style={{ height: '100%' }}>
      {/* Search and Row Count - Aligned with Content */}
      <div className="w-full mb-4">
        <div className="max-w-5xl mx-auto">
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search stations..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 pr-4 py-2 border border-gray-300 text-gray-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                </div>

                {/* Reset Button */}
                <button
                  onClick={resetList}
                  className="text-sm text-gray-500 hover:text-gray-700 underline whitespace-nowrap"
                >
                  Reset
                </button>
              </div>

              {/* Station count row */}
              <div className="text-sm text-gray-600 whitespace-nowrap">
                {isFiltered ? (
                  <>Showing {filteredCount} of {totalCount} stations</>
                ) : (
                  <>{totalCount} stations</>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content Container */}
      <div className="flex-1 w-full">
        <div className="max-w-5xl mx-auto">
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden" style={{ height: 'calc(100vh - 320px)' }}>
            {filteredData.length === 0 ? (
              <div className="p-8 text-center text-gray-500">No stations match your search</div>
            ) : (
              <div className="h-full overflow-y-auto">
                <table className="w-full">
                  <tbody className="divide-y divide-gray-100">
                    {filteredData.map((station) => (
            <tr
              key={station.id}
              onClick={() => onStationClick(station.id.toString())}
              className="hover:bg-gray-50 cursor-pointer transition-all duration-200 group"
            >
              <td className="p-4">
                {/* Desktop Layout - All in one row */}
                <div className="hidden md:flex md:items-center md:w-full">
                  <div className="flex-1 min-w-0">
                    <div className="text-lg font-semibold text-gray-900 truncate">
                      {station.label}
                    </div>
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="text-lg text-gray-500">
                      {station.ip}
                    </div>
                  </div>
                  
                  <div className="flex-1 text-center">
                    <div className="text-lg font-semibold text-gray-900">
                      <div className={`flex items-center justify-center gap-2 ${getStatusColor(station.online)}`}>
                        <svg
                          aria-hidden="true"
                          focusable="false"
                          data-prefix="fas"
                          data-icon="globe"
                          className="w-6 h-6"
                          role="img"
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 640 640"
                          fill="currentColor"
                        >
                          <g transform="translate(64, 64)">
                            <path d="M352 256c0 22.2-1.2 43.6-3.3 64H163.3c-2.2-20.4-3.3-41.8-3.3-64s1.2-43.6 3.3-64H348.7c2.2 20.4 3.3 41.8 3.3 64zm28.8-64H503.9c5.3 20.5 8.1 41.9 8.1 64s-2.8 43.5-8.1 64H380.8c2.1-20.6 3.2-42 3.2-64s-1.1-43.4-3.2-64zm112.6-32H376.7c-10-63.9-29.8-117.4-55.3-151.6c78.3 20.7 142 77.5 171.9 151.6zm-149.1 0H167.7c6.1-36.4 15.5-68.6 27-94.7c10.5-23.6 22.2-40.7 33.5-51.5C239.4 3.2 248.7 0 256 0s16.6 3.2 27.8 13.8c11.3 10.8 23 27.9 33.5 51.5c11.6 26 20.9 58.2 27 94.7zm-209 0H18.6C48.6 85.9 112.2 29.1 190.6 8.4C165.1 42.6 145.3 96.1 135.3 160zM8.1 192H131.2c-2.1 20.6-3.2 42-3.2 64s1.1 43.4 3.2 64H8.1C2.8 299.5 0 278.1 0 256s2.8-43.5 8.1-64zM194.7 446.6c-11.6-26-20.9-58.2-27-94.6H344.3c-6.1 36.4-15.5 68.6-27 94.6c-10.5 23.6-22.2 40.7-33.5 51.5C272.6 508.8 263.3 512 256 512s-16.6-3.2-27.8-13.8c-11.3-10.8-23-27.9-33.5-51.5zM135.3 352c10 63.9 29.8 117.4 55.3 151.6C112.2 482.9 48.6 426.1 18.6 352H135.3zm358.1 0c-30 74.1-93.6 130.9-171.9 151.6c25.5-34.2 45.2-87.7 55.3-151.6H493.4z"/>
                          </g>
                        </svg>
                        <span>{station.online}%</span>
                      </div>
                    </div>
                    <div className="text-sm text-gray-500">Online 24h</div>
                  </div>
                  
                  <div className="flex-1 text-center">
                    <div className="text-lg font-semibold text-gray-900">
                      <div className={`flex items-center justify-center gap-2 ${getStatusColor(station.health)}`}>
                        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
                        </svg>
                        <span>{station.health !== null ? `${station.health}%` : 'No data'}</span>
                      </div>
                    </div>
                    <div className="text-sm text-gray-500">Health 24h</div>
                  </div>
                </div>

                {/* Mobile Layout - Stacked */}
                <div className="md:hidden">
                  <div className="flex items-start justify-between">
                    {/* Left side - Label and IP stacked */}
                    <div className="flex-1 min-w-0">
                      <div className="text-base font-semibold text-gray-900 truncate">
                        {station.label}
                      </div>
                      <div className="text-sm text-gray-500 mt-1">
                        {station.ip}
                      </div>
                    </div>
                    
                    {/* Right side - Online and Health stacked vertically */}
                    <div className="flex flex-col items-end gap-2 ml-4">
                      <div className="text-center">
                        <div className="text-sm font-semibold text-gray-900">
                          <div className={`flex items-center justify-center gap-1 ${getStatusColor(station.online)}`}>
                            <svg
                              className="w-4 h-4"
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 640 640"
                              fill="currentColor"
                            >
                              <g transform="translate(64, 64)">
                                <path d="M352 256c0 22.2-1.2 43.6-3.3 64H163.3c-2.2-20.4-3.3-41.8-3.3-64s1.2-43.6 3.3-64H348.7c2.2 20.4 3.3 41.8 3.3 64zm28.8-64H503.9c5.3 20.5 8.1 41.9 8.1 64s-2.8 43.5-8.1 64H380.8c2.1-20.6 3.2-42 3.2-64s-1.1-43.4-3.2-64zm112.6-32H376.7c-10-63.9-29.8-117.4-55.3-151.6c78.3 20.7 142 77.5 171.9 151.6zm-149.1 0H167.7c6.1-36.4 15.5-68.6 27-94.7c10.5-23.6 22.2-40.7 33.5-51.5C239.4 3.2 248.7 0 256 0s16.6 3.2 27.8 13.8c11.3 10.8 23 27.9 33.5 51.5c11.6 26 20.9 58.2 27 94.7zm-209 0H18.6C48.6 85.9 112.2 29.1 190.6 8.4C165.1 42.6 145.3 96.1 135.3 160zM8.1 192H131.2c-2.1 20.6-3.2 42-3.2 64s1.1 43.4 3.2 64H8.1C2.8 299.5 0 278.1 0 256s2.8-43.5 8.1-64zM194.7 446.6c-11.6-26-20.9-58.2-27-94.6H344.3c-6.1 36.4-15.5 68.6-27 94.6c-10.5 23.6-22.2-40.7-33.5-51.5C272.6 508.8 263.3 512 256 512s-16.6-3.2-27.8-13.8c-11.3-10.8-23-27.9-33.5-51.5zM135.3 352c10 63.9 29.8 117.4 55.3 151.6C112.2 482.9 48.6 426.1 18.6 352H135.3zm358.1 0c-30 74.1-93.6 130.9-171.9 151.6c25.5-34.2 45.2-87.7 55.3-151.6H493.4z"/>
                              </g>
                            </svg>
                            <span>{station.online}%</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="text-center">
                        <div className="text-sm font-semibold text-gray-900">
                          <div className={`flex items-center justify-center gap-1 ${getStatusColor(station.health)}`}>
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
                            </svg>
                            <span>{station.health !== null ? `${station.health}%` : 'N/A'}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}