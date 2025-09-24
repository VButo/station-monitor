'use client'

import React, { useState, useEffect, useMemo } from 'react';
import { AgGridReact } from 'ag-grid-react';
import api from '@/utils/api';
import ProtectedRoute from '@/components/ProtectedRoute';
import {
  ModuleRegistry,
  AllCommunityModule,
  ColDef,
  GridReadyEvent,
  ModelUpdatedEvent,
  FilterChangedEvent,
  GridApi
} from 'ag-grid-community';
import { AdvancedStationData } from '@/types/station';
import TimelineCell from '@/components/TimelineCell';
import { useRouter } from 'next/navigation';

ModuleRegistry.registerModules([AllCommunityModule]);

export default function AdvancedPage() {
  return (
    <ProtectedRoute>
      <AdvancedPageContent />
    </ProtectedRoute>
  );
}

function AdvancedPageContent() {
  const [stationData, setStationData] = useState<AdvancedStationData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [gridApi, setGridApi] = useState<GridApi | null>(null);
  const [rowCount, setRowCount] = useState(0);
  const [columnStructure, setColumnStructure] = useState<{
    public_data: Record<string, string>;
    status_data: Record<string, string>;
    measurements_data: Record<string, string>;
  }>({
    public_data: {},
    status_data: {},
    measurements_data: {}
  });
  const [filteredCount, setFilteredCount] = useState(0);
  const [isFiltered, setIsFiltered] = useState(false);
  const [showColumnSelector, setShowColumnSelector] = useState(false);
  const [selectedColumns, setSelectedColumns] = useState<Set<string>>(new Set([
    // Default basic columns that are always selected
    'label_id', 'label_name', 'label_type', 'avg_fetch_health_24h'
  ]));
  const [isProcessingColumns, setIsProcessingColumns] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [isAutoRefreshing, setIsAutoRefreshing] = useState(false);
  
  // Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [healthFilter, setHealthFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const router = useRouter();

  // Extract data loading function for reuse
  const loadAdvancedData = async (isAutoRefresh = false) => {
    try {
      if (isAutoRefresh) {
        setIsAutoRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);
      
      // Make a single call to get both data and keys
      const res = await api.get<{
        stations: AdvancedStationData[], 
        columnStructure: {
          public_data: Record<string, string>;
          status_data: Record<string, string>;
          measurements_data: Record<string, string>;
        },
        metadata: {
          publicKeys: string[];
          statusKeys: string[];
          measurementKeys: string[];
          totalStations: number;
          generatedAt: string;
        }
      }>('/stations/advanced-table');
      
      setStationData(res.data.stations);
      setColumnStructure(res.data.columnStructure);
      setLastRefresh(new Date());
      
      console.log(`${isAutoRefresh ? 'Auto-refreshed' : 'Loaded'} station data:`, res.data.stations.length);
      console.log('Column structure:', {
        publicKeys: Object.keys(res.data.columnStructure.public_data).length,
        statusKeys: Object.keys(res.data.columnStructure.status_data).length,
        measurementKeys: Object.keys(res.data.columnStructure.measurements_data).length
      });
    } catch (err) {
      console.error('Error fetching advanced station data:', err);
      setError('Failed to load advanced station data');
    } finally {
      if (isAutoRefresh) {
        setIsAutoRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  };

  // Load data on component mount and set up auto-refresh
  useEffect(() => {
    // Initial load
    loadAdvancedData();

    // Set up auto-refresh every 10 minutes (600,000 milliseconds)
    const refreshInterval = setInterval(() => {
      console.log('Auto-refreshing advanced station data...');
      loadAdvancedData(true);
    }, 10 * 60 * 1000); // 10 minutes

    // Cleanup interval on component unmount
    return () => {
      clearInterval(refreshInterval);
    };
  }, []);

  // Note: No need for column visibility initialization since we use selectedColumns Set

  // Close column selector when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showColumnSelector) {
        const target = event.target as Element;
        if (!target.closest('.column-selector-container')) {
          setShowColumnSelector(false);
        }
      }
    };

    if (showColumnSelector) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showColumnSelector]);

  // Generate dynamic column definitions based on selected columns only
  const columnDefs = useMemo((): ColDef[] => {
    console.log('Generating column definitions, selected columns:', Array.from(selectedColumns));
    if (stationData.length === 0 || !columnStructure.public_data || Object.keys(columnStructure.public_data).length === 0) return [];

    // Get all possible keys from the column structure
    const publicKeys = Object.keys(columnStructure.public_data);
    const statusKeys = Object.keys(columnStructure.status_data);
    const measurementKeys = Object.keys(columnStructure.measurements_data);
    
    console.log('Available keys:', {
      publicKeys: publicKeys.length,
      statusKeys: statusKeys.length,
      measurementKeys: measurementKeys.length
    });

    const columns: ColDef[] = [];

    // Always include basic station info if selected
    if (selectedColumns.has('label_id')) {
      columns.push({
        headerName: 'ID',
        field: 'label_id',
        pinned: 'left',
        minWidth: 80,
        maxWidth: 100,
        cellStyle: { fontWeight: '600' },
        filter: 'agNumberColumnFilter',
        filterParams: {
          buttons: ['reset', 'apply'],
        }
      });
    }

    if (selectedColumns.has('label_name')) {
      columns.push({
        headerName: 'Station Name',
        field: 'label_name',
        pinned: 'left',
        minWidth: 200,
        flex: 1,
        cellStyle: { fontWeight: '600', fontSize: '16px' },
        filter: 'agTextColumnFilter',
        filterParams: {
          buttons: ['reset', 'apply'],
          debounceMs: 300,
        }
      });
    }

    if (selectedColumns.has('label_type')) {
      columns.push({
        headerName: 'Type',
        field: 'label_type',
        pinned: 'left',
        minWidth: 100,
        maxWidth: 120,
        filter: 'agTextColumnFilter',
        filterParams: {
          buttons: ['reset', 'apply'],
        }
      });
    }

    // Add location columns if selected
    if (selectedColumns.has('latitude')) {
      columns.push({
        headerName: 'Latitude',
        field: 'latitude',
        minWidth: 120,
        valueFormatter: params => params.value ? params.value.toFixed(6) : '',
        filter: 'agNumberColumnFilter',
        filterParams: {
          buttons: ['reset', 'apply'],
        }
      });
    }

    if (selectedColumns.has('longitude')) {
      columns.push({
        headerName: 'Longitude',
        field: 'longitude',
        minWidth: 120,
        valueFormatter: params => params.value ? params.value.toFixed(6) : '',
        filter: 'agNumberColumnFilter',
        filterParams: {
          buttons: ['reset', 'apply'],
        }
      });
    }

    if (selectedColumns.has('altitude')) {
      columns.push({
        headerName: 'Altitude',
        field: 'altitude',
        minWidth: 100,
        valueFormatter: params => params.value ? `${params.value}m` : '',
        filter: 'agNumberColumnFilter',
        filterParams: {
          buttons: ['reset', 'apply'],
        }
      });
    }

    if (selectedColumns.has('ip')) {
      columns.push({
        headerName: 'IP Address',
        field: 'ip',
        minWidth: 150,
        filter: 'agTextColumnFilter',
        filterParams: {
          buttons: ['reset', 'apply'],
        }
      });
    }

    // Add health/status columns if selected
    if (selectedColumns.has('avg_fetch_health_24h')) {
      columns.push({
        headerName: 'Online (24h)',
        field: 'avg_fetch_health_24h',
        minWidth: 120,
        maxWidth: 150,
        valueFormatter: params => params.value != null ? `${params.value}%` : '',
        filter: 'agNumberColumnFilter',
        filterParams: {
          buttons: ['reset', 'apply'],
        }
      });
    }

    if (selectedColumns.has('avg_fetch_health_7d')) {
      columns.push({
        headerName: 'Online (7d)',
        field: 'avg_fetch_health_7d',
        minWidth: 120,
        maxWidth: 150,
        valueFormatter: params => params.value != null ? `${params.value}%` : '',
        filter: 'agNumberColumnFilter',
        filterParams: {
          buttons: ['reset', 'apply'],
        }
      });
    }

    if (selectedColumns.has('avg_data_health_24h')) {
      columns.push({
        headerName: 'Health (24h)',
        field: 'avg_data_health_24h',
        minWidth: 130,
        maxWidth: 160,
        valueFormatter: params => params.value != null ? `${params.value}%` : '',
        filter: 'agNumberColumnFilter',
        filterParams: {
          buttons: ['reset', 'apply'],
        }
      });
    }

    if (selectedColumns.has('avg_data_health_7d')) {
      columns.push({
        headerName: 'Health (7d)',
        field: 'avg_data_health_7d',
        minWidth: 130,
        maxWidth: 160,
        valueFormatter: params => params.value != null ? `${params.value}%` : '',
        filter: 'agNumberColumnFilter',
        filterParams: {
          buttons: ['reset', 'apply'],
        }
      });
    }

    if (selectedColumns.has('hourly_status')) {
      columns.push({
        headerName: 'Status Timeline (24h)',
        field: 'hourly_status',
        cellRenderer: TimelineCell,
        cellRendererParams: (params: { data?: AdvancedStationData }) => ({
          timestamps: params.data?.hourly_timestamps,
        }),
        sortable: false,
        filter: false,
        minWidth: 250
      });
    }

    if (selectedColumns.has('total_measurements')) {
      columns.push({
        headerName: 'Total Measurements',
        field: 'total_measurements',
        minWidth: 150,
        filter: 'agNumberColumnFilter',
        filterParams: {
          buttons: ['reset', 'apply'],
        }
      });
    }

    if (selectedColumns.has('last_updated')) {
      columns.push({
        headerName: 'Last Updated',
        field: 'last_updated',
        minWidth: 180,
        valueFormatter: params => params.value ? new Date(params.value).toLocaleString() : '',
        filter: 'agDateColumnFilter',
        filterParams: {
          buttons: ['reset', 'apply'],
          comparator: (filterLocalDateAtMidnight: Date, cellValue: string) => {
            if (cellValue == null) return -1;
            const cellDate = new Date(cellValue);
            if (cellDate < filterLocalDateAtMidnight) return -1;
            if (cellDate > filterLocalDateAtMidnight) return 1;
            return 0;
          }
        }
      });
    }

    // Add dynamic public data columns if selected
    publicKeys.forEach(key => {
      const colId = `public_data.${key}`;
      if (selectedColumns.has(colId)) {
        columns.push({
          headerName: `Public: ${key}`,
          field: colId,
          minWidth: 120,
          valueGetter: params => params.data?.public_data?.[key] || '',
          filter: 'agTextColumnFilter',
          filterParams: {
            buttons: ['reset', 'apply'],
          }
        });
      }
    });

    // Add dynamic status data columns if selected
    statusKeys.forEach(key => {
      const colId = `status_data.${key}`;
      if (selectedColumns.has(colId)) {
        columns.push({
          headerName: `Status: ${key}`,
          field: colId,
          minWidth: 120,
          valueGetter: params => params.data?.status_data?.[key] || '',
          filter: 'agTextColumnFilter',
          filterParams: {
            buttons: ['reset', 'apply'],
          }
        });
      }
    });

    // Add dynamic measurement data columns if selected
    measurementKeys.forEach(key => {
      const colId = `measurements_data.${key}`;
      if (selectedColumns.has(colId)) {
        columns.push({
          headerName: `Measurement: ${key}`,
          field: colId,
          minWidth: 120,
          valueGetter: params => params.data?.measurements_data?.[key] || '',
          filter: 'agNumberColumnFilter',
          filterParams: {
            buttons: ['reset', 'apply'],
          }
        });
      }
    });

    console.log(`Generated ${columns.length} column definitions`);
    return columns;
  }, [stationData, columnStructure, selectedColumns]);

  const updateCounts = (api: GridApi, totalRows: number) => {
    const displayedCount = api.getDisplayedRowCount();
    setRowCount(totalRows);
    setFilteredCount(displayedCount);
    setIsFiltered(displayedCount !== totalRows);
  };

  const onGridReady = (params: GridReadyEvent) => {
    console.log('Grid ready event fired');
    setGridApi(params.api);

    const allColumns = params.api.getColumns();
    if (allColumns) {
      console.log('Columns available at grid ready:', allColumns.map(col => col.getColId()));
    }

    setTimeout(() => {
      const delayedColumns = params.api.getColumns();
      if (delayedColumns) {
        console.log('Columns available after delay:', delayedColumns.map(col => col.getColId()));
      }
    }, 100);
  };

  const onModelUpdated = (params: ModelUpdatedEvent) => {
    updateCounts(params.api, stationData.length);
  };

  const onFilterChanged = (params: FilterChangedEvent) => {
    updateCounts(params.api, stationData.length);
  };

  const resetGrid = () => {
    gridApi?.setFilterModel(null);
    gridApi?.deselectAll();
  };

  const resetGridCompletely = () => {
    gridApi?.setFilterModel(null);
    gridApi?.deselectAll();
    gridApi?.resetColumnState();
  };



  // Show basic columns only (reset to default selection)
  const hideAllExceptBasic = () => {
    setIsProcessingColumns(true);
    console.log('Resetting to basic view');
    setSelectedColumns(new Set([
      'label_id', 'label_name', 'label_type', 'avg_fetch_health_24h'
    ]));
    setTimeout(() => setIsProcessingColumns(false), 100);
  };

  // Show all available columns
  const showAllColumns = () => {
    if (!columnStructure.public_data) return;
    
    setIsProcessingColumns(true);
    console.log('Showing all columns');
    
    const allColumns = new Set([
      // Basic columns
      'label_id', 'label_name', 'label_type',
      // Location columns  
      'latitude', 'longitude', 'altitude', 'ip',
      // Health columns
      'avg_fetch_health_24h', 'avg_fetch_health_7d', 'hourly_status', 'avg_data_health_24h', 'avg_data_health_7d',
      'hourly_timestamps',
      'total_measurements', 'last_updated'
    ]);

    // Add all dynamic columns
    Object.keys(columnStructure.public_data).forEach(key => {
      allColumns.add(`public_data.${key}`);
    });
    Object.keys(columnStructure.status_data).forEach(key => {
      allColumns.add(`status_data.${key}`);
    });
    Object.keys(columnStructure.measurements_data).forEach(key => {
      allColumns.add(`measurements_data.${key}`);
    });

    setSelectedColumns(allColumns);
    setTimeout(() => setIsProcessingColumns(false), 100);
  };

  // Toggle individual column selection
  const toggleColumnVisibility = (columnId: string, isVisible: boolean) => {
    console.log(`Toggling column ${columnId} to ${isVisible ? 'selected' : 'deselected'}`);
    
    setSelectedColumns(prev => {
      const newSet = new Set(prev);
      if (isVisible) {
        newSet.add(columnId);
      } else {
        newSet.delete(columnId);
      }
      return newSet;
    });
  };

  // Toggle column group selection
  const toggleColumnGroup = (groupName: string, isVisible: boolean) => {
    if (stationData.length === 0) return;

    const publicKeys = Object.keys(columnStructure.public_data);
    const statusKeys = Object.keys(columnStructure.status_data);
    const measurementKeys = Object.keys(columnStructure.measurements_data);
    
    let columnsToToggle: string[] = [];
    
    switch (groupName) {
      case 'station-details':
        columnsToToggle = ['latitude', 'longitude', 'altitude', 'ip'];
        break;
      case 'status-health':
        columnsToToggle = ['avg_fetch_health_7d', 'hourly_status', 'hourly_timestamps', 'avg_data_health_24h', 'avg_data_health_7d', 'total_measurements', 'last_updated'];
        break;
      case 'public-data':
        columnsToToggle = publicKeys.map(key => `public_data.${key}`);
        break;
      case 'status-data':
        columnsToToggle = statusKeys.map(key => `status_data.${key}`);
        break;
      case 'measurements':
        columnsToToggle = measurementKeys.map(key => `measurements_data.${key}`);
        break;
    }

    console.log(`Toggling group ${groupName} with ${columnsToToggle.length} columns to ${isVisible ? 'selected' : 'deselected'}`);
    
    setSelectedColumns(prev => {
      const newSet = new Set(prev);
      columnsToToggle.forEach(colId => {
        if (isVisible) {
          newSet.add(colId);
        } else {
          newSet.delete(colId);
        }
      });
      return newSet;
    });
  };

  // Helper function to check if all columns in a group are selected
  const isGroupVisible = (groupName: string): boolean => {
    if (stationData.length === 0) return false;

    const publicKeys = Object.keys(columnStructure.public_data);
    const statusKeys = Object.keys(columnStructure.status_data);
    const measurementKeys = Object.keys(columnStructure.measurements_data);
    let columnsInGroup: string[] = [];

    switch (groupName) {
      case 'station-details':
        columnsInGroup = ['latitude', 'longitude', 'altitude', 'ip'];
        break;
      case 'status-health':
        columnsInGroup = ['avg_fetch_health_7d', 'hourly_status', 'hourly_timestamps', 'avg_data_health_24h', 'avg_data_health_7d', 'total_measurements', 'last_updated'];
        break;
      case 'public-data':
        columnsInGroup = publicKeys.map(key => `public_data.${key}`);
        break;
      case 'status-data':
        columnsInGroup = statusKeys.map(key => `status_data.${key}`);
        break;
      case 'measurements':
        columnsInGroup = measurementKeys.map(key => `measurements_data.${key}`);
        break;
    }

    return columnsInGroup.length > 0 && columnsInGroup.every(colId => selectedColumns.has(colId));
  };

  const toggleColumnSelector = () => {
    setShowColumnSelector(!showColumnSelector);
  };

  // Filter functions
  const getUniqueTypes = () => {
    return Array.from(new Set(stationData.map(station => station.label_type).filter(Boolean)));
  };

  const filteredData = useMemo(() => {
    let filtered = stationData;

    // Search term filter (station name or ID)
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(station => 
        station.label_name?.toLowerCase().includes(term) ||
        station.label_id?.toString().includes(term)
      );
    }

    // Type filter
    if (selectedType) {
      filtered = filtered.filter(station => station.label_type === selectedType);
    }

    // Health filter
    if (healthFilter) {
      filtered = filtered.filter(station => {
        const health = station.avg_fetch_health_24h;
        switch (healthFilter) {
          case 'excellent':
            return health >= 90;
          case 'good':
            return health >= 70 && health < 90;
          case 'poor':
            return health >= 50 && health < 70;
          case 'bad':
            return health < 50;
          default:
            return true;
        }
      });
    }

    return filtered;
  }, [stationData, searchTerm, selectedType, healthFilter]);

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedType('');
    setHealthFilter('');
  };

  const handleRowClick = (stationId: number) => {
    router.push(`/station/${stationId}`);
  };

  if (error) {
    return (
      <div className="min-h-screen bg-red-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-800 mb-4">Error Loading Data</h1>
          <p className="text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header Section */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-gray-900">Advanced Station Data</h1>
            <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
              {loading ? '...' : stationData.length}
            </span>
            {isAutoRefreshing && (
              <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-medium animate-pulse">
                Auto-refreshing...
              </span>
            )}
          </div>
          
          {/* Manual Refresh Button */}
          <button
            onClick={() => loadAdvancedData(false)}
            disabled={loading || isAutoRefreshing}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed text-sm"
          >
            <svg 
              className={`w-4 h-4 ${loading || isAutoRefreshing ? 'animate-spin' : ''}`} 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {loading || isAutoRefreshing ? 'Refreshing...' : 'Refresh Now'}
          </button>
        </div>
        
        <div className="flex items-center justify-between">
          <p className="text-gray-600">Complete view with all station data tables • Auto-refreshes every 10 minutes</p>
          {lastRefresh && (
            <p className="text-sm text-gray-500">
              Last updated: {lastRefresh.toLocaleTimeString()}
            </p>
          )}
        </div>
      </div>

      {/* Column Control Buttons */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <button
          onClick={hideAllExceptBasic}
          disabled={isProcessingColumns}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-300 text-sm"
        >
          {isProcessingColumns ? 'Processing...' : 'Basic View'}
        </button>

        <button
          onClick={showAllColumns}
          disabled={isProcessingColumns}
          className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:bg-gray-300 text-sm"
        >
          {isProcessingColumns ? 'Processing...' : 'Show All Columns'}
        </button>

        <div className="relative column-selector-container">
          <button
            onClick={toggleColumnSelector}
            className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 text-sm flex items-center gap-2"
          >
            Column Groups ▼
          </button>

          {showColumnSelector && (
            <div className="absolute top-full left-0 mt-2 w-80 bg-white border border-gray-200 rounded-lg shadow-lg z-10 max-h-96 overflow-y-auto">
              <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                <h3 className="font-medium text-gray-900">Column Visibility</h3>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    setShowColumnSelector(false);
                  }}
                  className="text-gray-400 hover:text-gray-600 text-lg leading-none"
                >
                  ×
                </button>
              </div>
              
              <div className="p-4 space-y-4">
                {/* Station Details Group */}
                <div>
                  <label className="flex items-center space-x-2 font-medium text-gray-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isGroupVisible('station-details')}
                      onChange={(e) => toggleColumnGroup('station-details', e.target.checked)}
                      className="rounded border-gray-300"
                    />
                    <span>📍 Station Details</span>
                  </label>
                  <div className="ml-6 space-y-1">
                    {['latitude', 'longitude', 'altitude', 'ip'].map(colId => (
                      <label key={colId} className="flex items-center space-x-2 text-sm text-gray-600">
                        <input
                          type="checkbox"
                          checked={selectedColumns.has(colId)}
                          onChange={(e) => toggleColumnVisibility(colId, e.target.checked)}
                          className="rounded border-gray-300"
                        />
                        <span>{colId}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Status & Health Group */}
                <div>
                  <label className="flex items-center space-x-2 font-medium text-gray-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isGroupVisible('status-health')}
                      onChange={(e) => toggleColumnGroup('status-health', e.target.checked)}
                      className="rounded border-gray-300"
                    />
                    <span>💚 Status & Health</span>
                  </label>
                  <div className="ml-6 space-y-1">
                    {['avg_fetch_health_7d', 'hourly_status', 'avg_data_health_24h', 'avg_data_health_7d', 'total_measurements', 'last_updated'].map(colId => (
                      <label key={colId} className="flex items-center space-x-2 text-sm text-gray-600">
                        <input
                          type="checkbox"
                          checked={selectedColumns.has(colId)}
                          onChange={(e) => toggleColumnVisibility(colId, e.target.checked)}
                          className="rounded border-gray-300"
                        />
                        <span>{colId.replace(/_/g, ' ')}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Dynamic Groups */}
                {stationData.length > 0 && Object.keys(columnStructure.public_data).length > 0 && (
                  <div>
                    <label className="flex items-center space-x-2 font-medium text-gray-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isGroupVisible('public-data')}
                        onChange={(e) => toggleColumnGroup('public-data', e.target.checked)}
                        className="rounded border-gray-300"
                      />
                      <span>🌐 Public Data ({Object.keys(columnStructure.public_data).length})</span>
                    </label>
                    <div className="ml-6 space-y-1 max-h-32 overflow-y-auto">
                      {Object.keys(columnStructure.public_data).map(key => {
                        const colId = `public_data.${key}`;
                        return (
                          <label key={colId} className="flex items-center space-x-2 text-sm text-gray-600">
                            <input
                              type="checkbox"
                              checked={selectedColumns.has(colId)}
                              onChange={(e) => toggleColumnVisibility(colId, e.target.checked)}
                              className="rounded border-gray-300"
                            />
                            <span>{key}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}

                {stationData.length > 0 && Object.keys(columnStructure.status_data).length > 0 && (
                  <div>
                    <label className="flex items-center space-x-2 font-medium text-gray-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isGroupVisible('status-data')}
                        onChange={(e) => toggleColumnGroup('status-data', e.target.checked)}
                        className="rounded border-gray-300"
                      />
                      <span>📊 Status Data ({Object.keys(columnStructure.status_data).length})</span>
                    </label>
                    <div className="ml-6 space-y-1 max-h-32 overflow-y-auto">
                      {Object.keys(columnStructure.status_data).map(key => {
                        const colId = `status_data.${key}`;
                        return (
                          <label key={colId} className="flex items-center space-x-2 text-sm text-gray-600">
                            <input
                              type="checkbox"
                              checked={selectedColumns.has(colId)}
                              onChange={(e) => toggleColumnVisibility(colId, e.target.checked)}
                              className="rounded border-gray-300"
                            />
                            <span>{key}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}

                {stationData.length > 0 && Object.keys(columnStructure.measurements_data).length > 0 && (
                  <div>
                    <label className="flex items-center space-x-2 font-medium text-gray-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isGroupVisible('measurements')}
                        onChange={(e) => toggleColumnGroup('measurements', e.target.checked)}
                        className="rounded border-gray-300"
                      />
                      <span>📈 Measurements ({Object.keys(columnStructure.measurements_data).length})</span>
                    </label>
                    <div className="ml-6 space-y-1 max-h-32 overflow-y-auto">
                      {Object.keys(columnStructure.measurements_data).map(key => {
                        const colId = `measurements_data.${key}`;
                        return (
                          <label key={colId} className="flex items-center space-x-2 text-sm text-gray-600">
                            <input
                              type="checkbox"
                              checked={selectedColumns.has(colId)}
                              onChange={(e) => toggleColumnVisibility(colId, e.target.checked)}
                              className="rounded border-gray-300"
                            />
                            <span>{key}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <button
          onClick={() => setShowFilters(!showFilters)}
          className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 text-sm flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
          </svg>
          Filters {showFilters ? '▲' : '▼'}
        </button>
      </div>

      {/* Filter Controls */}
      {showFilters && (
        <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Search Input */}
            <div>
              <label htmlFor="searchStations" className="block text-sm font-medium text-gray-700 mb-1">
                Search Stations
              </label>
              <input
                id="searchStations"
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Station name or ID..."
                className="w-full px-3 py-2 border text-gray-500 border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Type Filter */}
            <div>
              <label htmlFor="stationType" className="block text-sm font-medium text-gray-700 mb-1">
                Station Type
              </label>
              <select
                id="stationType"
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="w-full px-3 py-2 border text-gray-500 border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">All Types</option>
                {getUniqueTypes().map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>

            {/* Health Filter */}
            <div>
              <label htmlFor="healthStatus" className="block text-sm font-medium text-gray-700 mb-1">
                Health Status
              </label>
              <select
                id="healthStatus"
                value={healthFilter}
                onChange={(e) => setHealthFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 text-gray-500 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">All Health Levels</option>
                <option value="excellent">Excellent (≥90%)</option>
                <option value="good">Good (70-89%)</option>
                <option value="poor">Poor (50-69%)</option>
                <option value="bad">Bad (&lt;50%)</option>
              </select>
            </div>

            {/* Clear Filters */}
            <div className="flex items-end">
              <button
                onClick={clearFilters}
                className="w-full px-3 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 text-sm"
              >
                Clear Filters
              </button>
            </div>
          </div>

          {/* Filter Results Summary */}
          <div className="mt-3 pt-3 border-t border-gray-200 text-sm text-gray-600">
            Showing {filteredData.length} of {stationData.length} stations
            {(searchTerm || selectedType || healthFilter) && (
              <span className="text-blue-600 ml-2">
                (filtered by: {[
                  searchTerm && 'search',
                  selectedType && 'type',
                  healthFilter && 'health'
                ].filter(Boolean).join(', ')})
              </span>
            )}
          </div>
        </div>
      )}

      {/* Content Area */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <p className="text-gray-600">Loading advanced station data...</p>
        </div>
      ) : (
        <>
          <div className="ag-theme-alpine" style={{ height: '600px', width: '100%' }}>
            <AgGridReact
              columnDefs={columnDefs}
              rowData={filteredData}
              onGridReady={onGridReady}
              onModelUpdated={onModelUpdated}
              onFilterChanged={onFilterChanged}
              //enableRangeSelection={true}
              animateRows={false}
              onRowClicked={(event) => {
                const id = event.data.id;
                console.log('Row clicked, station ID:', id);
                handleRowClick(id);
              }}
              suppressMenuHide={true}
              rowSelection="multiple"
              // Filtering configuration
              defaultColDef={{
                filter: true,
                sortable: true,
                resizable: true,
                floatingFilter: true,
              }}
              suppressRowClickSelection={true}
              enableBrowserTooltips={true}
            />
          </div>

          {/* Footer */}
          <div className="mt-4 flex items-center justify-between">
            <div className="flex gap-2">
              <button
                onClick={resetGrid}
                className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 text-sm"
              >
                Reset Filters
              </button>
              <button
                onClick={resetGridCompletely}
                className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 text-sm"
              >
                Reset All
              </button>
            </div>
            <p className="text-sm text-gray-600">
              Rows: {filteredCount} of {rowCount} {isFiltered && '(Filtered)'}
            </p>
          </div>
        </>
      )}
    </div>
  );
}
