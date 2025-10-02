'use client'

import React, { useState, useEffect } from 'react';
import api from '@/utils/api';
import ProtectedRoute from '@/components/ProtectedRoute';
import ColumnSelector from '@/components/ColumnSelector';
import ExportDropdown from '@/components/ExportDropdown';
import FilterControls from '@/components/FilterControls';
import AdvancedDataGrid from '@/components/AdvancedDataGrid';
import {
  ModuleRegistry,
  AllCommunityModule,
  GridReadyEvent,
  ModelUpdatedEvent,
  FilterChangedEvent
} from 'ag-grid-community';
import { AdvancedStationData } from '@/types/station';
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
  // State management
  const [stationData, setStationData] = useState<AdvancedStationData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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
    // Default basic columns (excluding always pinned columns: ID, Name, Type)
    'label', 'ip_address', 'online_24h_avg', 'data_health_24h_avg',
    // Default timestamp columns
    'public_timestamp', 'status_timestamp', 'measurements_timestamp'
  ]));
  const [isProcessingColumns, setIsProcessingColumns] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [isAutoRefreshing, setIsAutoRefreshing] = useState(false);
  
  // Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [healthFilter, setHealthFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  
  // Accordion state for column groups
  const [expandedGroup, setExpandedGroup] = useState<string>('station');
  
  // Export dropdown state
  const [showExportDropdown, setShowExportDropdown] = useState(false);

  const router = useRouter();

  // Data loading function
  const loadAdvancedData = async (isAutoRefresh = false) => {
    try {
      if (isAutoRefresh) {
        setIsAutoRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

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
      
      if (res.data?.stations?.length > 0) {
        setStationData(res.data.stations);
        setColumnStructure(res.data.columnStructure);
        setRowCount(res.data.stations.length);
        setLastRefresh(new Date());
        
        console.log('Advanced data loaded:', {
          stations: res.data.stations.length,
          publicKeys: Object.keys(res.data.columnStructure.public_data).length,
          statusKeys: Object.keys(res.data.columnStructure.status_data).length,
          measurementKeys: Object.keys(res.data.columnStructure.measurements_data).length
        });
      } else {
        console.warn('No data received from API');
        setStationData([]);
        setRowCount(0);
      }
    } catch (error) {
      console.error('Error fetching advanced station data:', error);
      setError('Failed to load station data. Please try again.');
      setStationData([]);
      setRowCount(0);
    } finally {
      setLoading(false);
      setIsAutoRefreshing(false);
    }
  };

  // Load data on mount
  useEffect(() => {
    loadAdvancedData();
  }, []);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (!loading && !error) {
        loadAdvancedData(true);
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [loading, error]);

  // Filter data based on search, type, and health criteria
  const filteredData = stationData.filter(station => {
    const matchesSearch = searchTerm === '' || 
      station.label_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      station.label_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      station.label?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      station.latitude?.toString().includes(searchTerm) ||
      station.longitude?.toString().includes(searchTerm);

    const matchesType = selectedType === '' || station.label_type === selectedType;
    
    const matchesHealth = healthFilter === '' || (() => {
      const health = station.avg_data_health_24h;
      if (health === null || health === undefined) return false;
      
      switch (healthFilter) {
        case 'healthy': return health > 80;
        case 'warning': return health >= 50 && health <= 80;
        case 'critical': return health < 50;
        default: return true;
      }
    })();

    return matchesSearch && matchesType && matchesHealth;
  });

  const uniqueTypes = [...new Set(stationData.map(station => station.label_type))].filter(Boolean);

  // Column management functions
  const showAllColumns = () => {
    if (!columnStructure.public_data) return;
    
    setIsProcessingColumns(true);
    console.log('Showing all columns');
    
    const allColumns = new Set([
      // All station columns
      'label', 'latitude', 'longitude', 'altitude', 
      'ip_address', 'sms_number', 'online_24h_avg', 'online_7d_avg', 'online_24h_graph', 
      'online_last_seen', 'data_health_24h_avg', 'data_health_7d_avg',
      // Timestamp columns
      'public_timestamp', 'status_timestamp', 'measurements_timestamp'
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

  const hideAllExceptBasic = () => {
    setIsProcessingColumns(true);
    console.log('Resetting to basic view');
    setSelectedColumns(new Set([
      // Basic station columns
      'label', 'ip_address', 'online_24h_avg', 'data_health_24h_avg',
      // Timestamp columns for data freshness
      'public_timestamp', 'status_timestamp', 'measurements_timestamp'
    ]));
    setTimeout(() => setIsProcessingColumns(false), 100);
  };

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

  const toggleColumnGroup = (groupName: string, isVisible: boolean) => {
    if (stationData.length === 0) return;

    const publicKeys = Object.keys(columnStructure.public_data);
    const statusKeys = Object.keys(columnStructure.status_data);
    const measurementKeys = Object.keys(columnStructure.measurements_data);
    
    let columnsToToggle: string[] = [];
    
    switch (groupName) {
      case 'station':
        columnsToToggle = [
          'label', 'latitude', 'longitude', 'altitude', 
          'ip_address', 'sms_number', 'online_24h_avg', 'online_7d_avg', 'online_24h_graph', 
          'online_last_seen', 'data_health_24h_avg', 'data_health_7d_avg'
        ];
        break;
      case 'public-data':
        columnsToToggle = ['public_timestamp', ...publicKeys.map(key => `public_data.${key}`)];
        break;
      case 'status-data':
        columnsToToggle = ['status_timestamp', ...statusKeys.map(key => `status_data.${key}`)];
        break;
      case 'measurements':
        columnsToToggle = ['measurements_timestamp', ...measurementKeys.map(key => `measurements_data.${key}`)];
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

  const getGroupState = (groupName: string): 'all' | 'some' | 'none' => {
    if (stationData.length === 0) return 'none';

    const publicKeys = Object.keys(columnStructure.public_data);
    const statusKeys = Object.keys(columnStructure.status_data);
    const measurementKeys = Object.keys(columnStructure.measurements_data);
    let columnsInGroup: string[] = [];

    switch (groupName) {
      case 'station':
        columnsInGroup = [
          'label', 'latitude', 'longitude', 'altitude', 
          'ip_address', 'sms_number', 'online_24h_avg', 'online_7d_avg', 'online_24h_graph', 
          'online_last_seen', 'data_health_24h_avg', 'data_health_7d_avg'
        ];
        break;
      case 'public-data':
        columnsInGroup = ['public_timestamp', ...publicKeys.map(key => `public_data.${key}`)];
        break;
      case 'status-data':
        columnsInGroup = ['status_timestamp', ...statusKeys.map(key => `status_data.${key}`)];
        break;
      case 'measurements':
        columnsInGroup = ['measurements_timestamp', ...measurementKeys.map(key => `measurements_data.${key}`)];
        break;
    }

    if (columnsInGroup.length === 0) return 'none';
    
    const selectedCount = columnsInGroup.filter(colId => selectedColumns.has(colId)).length;
    
    if (selectedCount === columnsInGroup.length) return 'all';
    if (selectedCount > 0) return 'some';
    return 'none';
  };

  const handleGroupClick = (groupName: string) => {
    setExpandedGroup(expandedGroup === groupName ? '' : groupName);
  };

  // Grid event handlers
  const onGridReady = (event: GridReadyEvent) => {
    // Grid is ready - can add additional setup here if needed
    console.log('Grid ready', event.api);
  };

  // Helper to update row counts from grid events
  const updateRowCounts = (event: ModelUpdatedEvent | FilterChangedEvent) => {
    const displayedRowCount = event.api.getDisplayedRowCount();
    setFilteredCount(displayedRowCount);
    setIsFiltered(displayedRowCount !== rowCount);
  };

  const onModelUpdated = updateRowCounts;
  const onFilterChanged = updateRowCounts;

  // Filter handlers
  const clearFilters = () => {
    setSearchTerm('');
    setSelectedType('');
    setHealthFilter('');
  };

  // Navigation handler
  const handleRowClick = (stationId: string) => {
    router.push(`/station/${stationId}`);
  };

  if (loading && !isAutoRefreshing) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-center items-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading advanced station data...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <h2 className="text-xl font-semibold text-red-800 mb-2">Error Loading Data</h2>
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={() => loadAdvancedData()}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Advanced Station Monitor</h1>
          <p className="text-gray-600 mt-1">
            Showing {isFiltered ? `${filteredCount} of ${rowCount}` : rowCount} stations
            {lastRefresh && (
              <span className="ml-2">
                • Last updated: {lastRefresh.toLocaleTimeString()}
                {isAutoRefreshing && <span className="animate-pulse ml-1">↻</span>}
              </span>
            )}
          </p>
        </div>
        
        <div className="flex items-center space-x-3">
          {/* Refresh Button */}
          <button
            onClick={() => loadAdvancedData()}
            disabled={loading || isAutoRefreshing}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
          >
            <span className={isAutoRefreshing ? 'animate-spin' : ''}>↻</span>
            <span>Refresh</span>
          </button>

          {/* Column Selector */}
          <div className="relative">
            <button
              onClick={() => setShowColumnSelector(!showColumnSelector)}
              data-column-toggle
              className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 flex items-center space-x-2"
            >
              <span>⚙️</span>
              <span>Columns</span>
            </button>
            
            <ColumnSelector
              showColumnSelector={showColumnSelector}
              selectedColumns={selectedColumns}
              expandedGroup={expandedGroup}
              columnStructure={columnStructure}
              isProcessingColumns={isProcessingColumns}
              stationData={stationData}
              onToggleColumnSelector={() => setShowColumnSelector(false)}
              onToggleColumnVisibility={toggleColumnVisibility}
              onToggleColumnGroup={toggleColumnGroup}
              onGetGroupState={getGroupState}
              onHandleGroupClick={handleGroupClick}
              onShowAllColumns={showAllColumns}
              onHideAllExceptBasic={hideAllExceptBasic}
            />
          </div>

          {/* Export Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowExportDropdown(!showExportDropdown)}
              data-export-toggle
              disabled={filteredData.length === 0}
              className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              <span>📥</span>
              <span>Export</span>
              <span className={`transform transition-transform ${showExportDropdown ? 'rotate-180' : ''}`}>▼</span>
            </button>
            
            <ExportDropdown
              showExportDropdown={showExportDropdown}
              filteredData={filteredData}
              onToggleExportDropdown={() => setShowExportDropdown(false)}
            />
          </div>
        </div>
      </div>

      {/* Filter Controls */}
      <FilterControls
        searchTerm={searchTerm}
        selectedType={selectedType}
        healthFilter={healthFilter}
        showFilters={showFilters}
        uniqueTypes={uniqueTypes}
        onSearchChange={setSearchTerm}
        onTypeChange={setSelectedType}
        onHealthFilterChange={setHealthFilter}
        onToggleFilters={() => setShowFilters(!showFilters)}
        onClearFilters={clearFilters}
      />

      {/* Data Grid */}
      <AdvancedDataGrid
        filteredData={filteredData}
        selectedColumns={selectedColumns}
        columnStructure={columnStructure}
        onGridReady={onGridReady}
        onModelUpdated={onModelUpdated}
        onFilterChanged={onFilterChanged}
        onRowClick={handleRowClick}
      />
    </div>
  );
}