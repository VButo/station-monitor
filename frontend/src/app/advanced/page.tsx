'use client'

import React, { useState, useEffect, useMemo, useRef } from 'react';
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
import * as ExcelJS from 'exceljs';

ModuleRegistry.registerModules([AllCommunityModule]);

// Three-state checkbox component
interface ThreeStateCheckboxProps {
  state: 'all' | 'some' | 'none';
  onChange: (checked: boolean) => void;
  className?: string;
}

const ThreeStateCheckbox: React.FC<ThreeStateCheckboxProps> = ({ state, onChange, className = '' }) => {
  const checkboxRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (checkboxRef.current) {
      checkboxRef.current.indeterminate = state === 'some';
    }
  }, [state]);

  return (
    <input
      ref={checkboxRef}
      type="checkbox"
      checked={state === 'all'}
      onChange={(e) => onChange(e.target.checked)}
      className={`rounded border-gray-300 transition-opacity duration-200 ${className}`}
      style={{
        opacity: state === 'some' ? 0.6 : 1,
        filter: state === 'some' ? 'saturate(0.7)' : 'none',
      }}
      title={
        state === 'all' 
          ? 'All items selected' 
          : state === 'some' 
          ? 'Some items selected' 
          : 'No items selected'
      }
    />
  );
};

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
    // Default basic columns (excluding always pinned columns: ID, Name, Type)
    'label', 'ip_address', 'online_24h_avg', 'data_health_24h_avg'
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
  
  // Refs for column dropdown to handle click outside
  const desktopDropdownRef = useRef<HTMLDivElement>(null);
  const mobileDropdownRef = useRef<HTMLDivElement>(null);
  const exportDropdownRef = useRef<HTMLDivElement>(null);

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

  // Export functions - exports current view with applied filters, sorts, and visible columns
  const exportToCSV = () => {
    if (!gridApi) return;
    
    const timestamp = new Date().toISOString().split('T')[0];
    const filterInfo = isFiltered ? 'filtered' : 'all';
    const filename = `station-monitor-${filterInfo}-data-${timestamp}.csv`;
    
    // Export with current filters and sorting applied
    gridApi.exportDataAsCsv({
      fileName: filename,
      onlySelected: false, // Export all filtered data
      skipColumnHeaders: false
    });
  };

  const exportToExcel = async () => {
    if (!gridApi) return;
    
    const timestamp = new Date().toISOString().split('T')[0];
    const filterInfo = isFiltered ? 'filtered' : 'all';
    const filename = `station-monitor-${filterInfo}-data-${timestamp}.xlsx`;
    
    // Get filtered and sorted data from AG-Grid
    const rowData: AdvancedStationData[] = [];
    gridApi.forEachNodeAfterFilterAndSort((node) => {
      if (node.data) {
        rowData.push(node.data as AdvancedStationData);
      }
    });
    
    if (rowData.length === 0) {
      alert('No data to export');
      return;
    }
    
    // Helper to get nested value from object by path
    function getNestedValue(obj: unknown, path: string[]): unknown {
      let current = obj;
      for (const key of path) {
        if (current && typeof current === 'object' && key in (current as Record<string, unknown>)) {
          current = (current as Record<string, unknown>)[key];
        } else {
          return undefined;
        }
      }
      return current;
    }

    // Get visible column definitions to determine what to export
    const visibleColumns = gridApi.getColumnDefs()?.filter(col => {
      // Type guard to check if it's a ColDef (not ColGroupDef)
      if ('field' in col && col.field) {
        const column = gridApi.getColumn(col.field);
        return column?.isVisible();
      }
      return false;
    }) || [];
    
    // Create export data with only visible columns
    const exportData = rowData.map(row => {
      const exportRow: Record<string, unknown> = {};
      visibleColumns.forEach(colDef => {
        // Type guard to ensure we have a ColDef with field
        if ('field' in colDef && colDef.field) {
          const field = colDef.field;
          const headerName = colDef.headerName || field;
          
          // Handle nested properties (like public_data.temperature)
          let value: unknown;
          if (field.includes('.')) {
            // Use helper function to navigate nested object path safely
            const parts = field.split('.');
            value = getNestedValue(row, parts);
          } else {
            value = (row as unknown as Record<string, unknown>)[field];
          }
          
          // Convert arrays to readable strings (like hourly_status)
          if (Array.isArray(value)) {
            value = value.join(', ');
          }
          
          exportRow[headerName] = value;
        }
      });
      return exportRow;
    });
    
    try {
      // Create workbook and worksheet using ExcelJS
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Station Data');
      
      // Add headers
      const headers = Object.keys(exportData[0] || {});
      worksheet.addRow(headers);
      
      // Style headers
      const headerRow = worksheet.getRow(1);
      headerRow.font = { bold: true };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE3F2FD' }
      };
      
      // Add data rows
      exportData.forEach(row => {
        const values = headers.map(header => row[header]);
        worksheet.addRow(values);
      });
      
      // Auto-fit columns
      worksheet.columns.forEach((column, index) => {
        const header = headers[index];
        const maxLength = Math.max(
          header?.length || 0,
          15 // minimum width
        );
        column.width = Math.min(maxLength * 1.2, 50); // max width of 50
      });
      
      // Generate buffer and download
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
      });
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      alert('Error exporting to Excel. Please try CSV export instead.');
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
      const target = event.target as Element;
      
      // Handle column selector dropdown
      if (showColumnSelector) {
        const desktopDropdown = desktopDropdownRef.current;
        const mobileDropdown = mobileDropdownRef.current;
        
        // Check if click is outside both the button and the dropdown (both desktop and mobile)
        const isOutsideDropdowns = !desktopDropdown?.contains(target) && !mobileDropdown?.contains(target);
        const isOutsideButton = !target.closest('.column-selector-container');
        
        if (isOutsideDropdowns && isOutsideButton) {
          setShowColumnSelector(false);
        }
      }
      
      // Handle export dropdown
      if (showExportDropdown) {
        const exportDropdown = exportDropdownRef.current;
        const isOutsideExportDropdown = !exportDropdown?.contains(target);
        const isOutsideExportButton = !target.closest('.export-dropdown-container');
        
        if (isOutsideExportDropdown && isOutsideExportButton) {
          setShowExportDropdown(false);
        }
      }
    };

    if (showColumnSelector || showExportDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showColumnSelector, showExportDropdown]);

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

    // Always include these basic station info columns (pinned left, not configurable)
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

    columns.push({
      headerName: 'Name',
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

    // Add configurable station info columns if selected
    if (selectedColumns.has('label')) {
      columns.push({
        headerName: 'Label',
        field: 'label',
        minWidth: 150,
        filter: 'agTextColumnFilter',
        filterParams: {
          buttons: ['reset', 'apply'],
          debounceMs: 300,
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

    if (selectedColumns.has('ip_address')) {
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

    if (selectedColumns.has('sms_number')) {
      columns.push({
        headerName: 'SMS Number',
        field: 'sms_number',
        minWidth: 150,
        filter: 'agTextColumnFilter',
        filterParams: {
          buttons: ['reset', 'apply'],
        }
      });
    }

    // Add health/status columns if selected
    if (selectedColumns.has('online_24h_avg')) {
      columns.push({
        headerName: 'Online_24h_Avg',
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

    if (selectedColumns.has('online_7d_avg')) {
      columns.push({
        headerName: 'Online_7d_Avg',
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

    if (selectedColumns.has('online_24h_graph')) {
      columns.push({
        headerName: 'Online_24h_Graph',
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

    if (selectedColumns.has('online_last_seen')) {
      columns.push({
        headerName: 'Online_Last_Seen',
        field: 'last_updated',
        minWidth: 160,
        valueFormatter: params => {
          if (!params.value) return '';
          const date = new Date(params.value);
          return date.toLocaleString();
        },
        filter: 'agDateColumnFilter',
        filterParams: {
          buttons: ['reset', 'apply'],
          comparator: (filterDate: Date, cellValue: string) => {
            const cellDate = new Date(cellValue);
            return cellDate.getTime() - filterDate.getTime();
          }
        }
      });
    }

    if (selectedColumns.has('data_health_24h_avg')) {
      columns.push({
        headerName: 'Data_Health_24h_Avg',
        field: 'avg_data_health_24h',
        minWidth: 130,
        maxWidth: 170,
        valueFormatter: params => params.value != null ? `${params.value}%` : '',
        filter: 'agNumberColumnFilter',
        filterParams: {
          buttons: ['reset', 'apply'],
        }
      });
    }

    if (selectedColumns.has('data_health_7d_avg')) {
      columns.push({
        headerName: 'Data_Health_7d_Avg',
        field: 'avg_data_health_7d',
        minWidth: 130,
        maxWidth: 170,
        valueFormatter: params => params.value != null ? `${params.value}%` : '',
        filter: 'agNumberColumnFilter',
        filterParams: {
          buttons: ['reset', 'apply'],
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



  // Show basic columns only (reset to default selection)
  const hideAllExceptBasic = () => {
    setIsProcessingColumns(true);
    console.log('Resetting to basic view');
    setSelectedColumns(new Set([
      'label_id', 'label_name', 'label_type', 'label', 'ip_address', 'online_24h_avg', 'data_health_24h_avg'
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
      case 'station':
        // Exclude pinned columns (label_id, label_name, label_type) - they're always visible
        columnsToToggle = [
          'label', 'latitude', 'longitude', 'altitude', 
          'ip_address', 'sms_number', 'online_24h_avg', 'online_7d_avg', 'online_24h_graph', 
          'online_last_seen', 'data_health_24h_avg', 'data_health_7d_avg'
          /* 'online_7d_graph', 'data_health_24h_graph', 'data_health_7d_graph' - commented out as requested */
        ];
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

  // Helper function to get group selection state (fully selected, partially selected, or not selected)
  const getGroupState = (groupName: string): 'all' | 'some' | 'none' => {
    if (stationData.length === 0) return 'none';

    const publicKeys = Object.keys(columnStructure.public_data);
    const statusKeys = Object.keys(columnStructure.status_data);
    const measurementKeys = Object.keys(columnStructure.measurements_data);
    let columnsInGroup: string[] = [];

    switch (groupName) {
      case 'station':
        // Exclude pinned columns (label_id, label_name, label_type) - they're always visible
        columnsInGroup = [
          'label', 'latitude', 'longitude', 'altitude', 
          'ip_address', 'sms_number', 'online_24h_avg', 'online_7d_avg', 'online_24h_graph', 
          'online_last_seen', 'data_health_24h_avg', 'data_health_7d_avg'
        ];
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

    if (columnsInGroup.length === 0) return 'none';
    
    const selectedCount = columnsInGroup.filter(colId => selectedColumns.has(colId)).length;
    
    if (selectedCount === columnsInGroup.length) return 'all';
    if (selectedCount > 0) return 'some';
    return 'none';
  };

  const toggleColumnSelector = () => {
    setShowColumnSelector(!showColumnSelector);
  };

  // Handle group expansion/collapse
  const handleGroupClick = (groupName: string) => {
    const isOpening = expandedGroup !== groupName;
    setExpandedGroup(expandedGroup === groupName ? '' : groupName);
    
    // Reset scroll position to top when opening a group
    if (isOpening) {
      // Reset scroll for desktop dropdown
      const desktopScrollContainer = desktopDropdownRef.current?.querySelector('.flex-1.overflow-y-auto');
      if (desktopScrollContainer) {
        desktopScrollContainer.scrollTop = 0;
      }
      
      // Reset scroll for mobile dropdown  
      const mobileScrollContainer = mobileDropdownRef.current?.querySelector('.overflow-hidden');
      if (mobileScrollContainer) {
        mobileScrollContainer.scrollTop = 0;
      }
    }
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
            <h1 className="text-3xl font-bold text-gray-900">Advanced View</h1>
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
            Columns ▼
          </button>
        </div>

        {/* Export Dropdown */}
        <div className="relative export-dropdown-container">
          <button
            onClick={() => setShowExportDropdown(!showExportDropdown)}
            disabled={!gridApi || stationData.length === 0}
            className="px-4 py-2 bg-emerald-500 text-white rounded hover:bg-emerald-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-sm flex items-center gap-2"
            title="Export filtered data"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Export ▼
          </button>
          
          {showExportDropdown && (
            <div ref={exportDropdownRef} className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
              <button
                onClick={() => {
                  exportToCSV();
                  setShowExportDropdown(false);
                }}
                className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center gap-3 text-sm text-gray-700 border-b border-gray-100"
              >
                <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Export as CSV
              </button>
              <button
                onClick={() => {
                  exportToExcel();
                  setShowExportDropdown(false);
                }}
                className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center gap-3 text-sm text-gray-700"
              >
                <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Export as Excel
              </button>
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
          {/* Desktop Sidebar + Table Layout */}
          <div className={`hidden lg:flex gap-4 ${showColumnSelector ? '' : 'block'}`}>
            {/* Desktop Column Selector Sidebar */}
            {showColumnSelector && (
              <div ref={desktopDropdownRef} className="w-95 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden flex flex-col" style={{ height: '600px' }}>
                <div className="p-4 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
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
                
                <div className="flex-1 overflow-y-auto">
                  {/* Station Group */}
                  <div className="border-b border-gray-200">
                    <button
                      onClick={(e) => {
                        // Prevent group toggle if clicking on checkbox
                        if (e.target instanceof HTMLElement && e.target.closest('.three-state-checkbox')) {
                          return;
                        }
                        handleGroupClick('station');
                      }}
                      className="w-full p-4 text-left hover:bg-gray-50 flex items-center justify-between"
                    >
                      <div className="flex items-center space-x-2">
                        <span className="text-gray-400">
                          {expandedGroup === 'station' ? '▼' : '▶'}
                        </span>
                        <div className="three-state-checkbox" onClick={(e) => e.stopPropagation()}>
                          <ThreeStateCheckbox
                            state={getGroupState('station')}
                            onChange={(checked) => {
                              toggleColumnGroup('station', checked);
                            }}
                          />
                        </div>
                        <span className="font-medium text-gray-700">🏢 Station</span>
                      </div>
                    </button>
                    {expandedGroup === 'station' && (
                      <div className="px-4 pb-4 space-y-2" onClick={(e) => e.stopPropagation()}>
                        {/* Note: ID, Name, and Type are always pinned left and not configurable */}
                        {[
                          { id: 'label', label: 'Label' },
                          { id: 'latitude', label: 'Latitude' },
                          { id: 'longitude', label: 'Longitude' },
                          { id: 'altitude', label: 'Altitude' },
                          { id: 'ip_address', label: 'IP Address' },
                          { id: 'sms_number', label: 'SMS Number' },
                          { id: 'online_24h_avg', label: 'Online 24h Avg' },
                          { id: 'online_7d_avg', label: 'Online 7d Avg' },
                          { id: 'online_24h_graph', label: 'Online 24h Graph' },
                          { id: 'online_last_seen', label: 'Online Last Seen' },
                          { id: 'data_health_24h_avg', label: 'Data Health 24h Avg' },
                          { id: 'data_health_7d_avg', label: 'Data Health 7d Avg' },
                        ].map(({ id, label }) => (
                          <label key={id} className="flex items-center space-x-2 text-sm text-gray-600 ml-6">
                            <input
                              type="checkbox"
                              checked={selectedColumns.has(id)}
                              onChange={(e) => {
                                e.stopPropagation();
                                toggleColumnVisibility(id, e.target.checked);
                              }}
                              className="rounded border-gray-300"
                            />
                            <span>{label}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Public Data Group */}
                  {stationData.length > 0 && Object.keys(columnStructure.public_data).length > 0 && (
                    <div className="border-b border-gray-200">
                      <button
                        onClick={(e) => {
                          // Prevent group toggle if clicking on checkbox
                          if (e.target instanceof HTMLElement && e.target.closest('.three-state-checkbox')) {
                            return;
                          }
                          handleGroupClick('public-data');
                        }}
                        className="w-full p-4 text-left hover:bg-gray-50 flex items-center justify-between"
                      >
                        <div className="flex items-center space-x-2">
                          <span className="text-gray-400">
                            {expandedGroup === 'public-data' ? '▼' : '▶'}
                          </span>
                          <div className="three-state-checkbox" onClick={(e) => e.stopPropagation()}>
                            <ThreeStateCheckbox
                              state={getGroupState('public-data')}
                              onChange={(checked) => {
                                toggleColumnGroup('public-data', checked);
                              }}
                            />
                          </div>
                          <span className="font-medium text-gray-700">🌐 Public Data ({Object.keys(columnStructure.public_data).length})</span>
                        </div>
                      </button>
                      {expandedGroup === 'public-data' && (
                        <div className="px-4 pb-4 space-y-2" onClick={(e) => e.stopPropagation()}>
                          {Object.keys(columnStructure.public_data).map(key => {
                            const colId = `public_data.${key}`;
                            return (
                              <label key={colId} className="flex items-center space-x-2 text-sm text-gray-600 ml-6">
                                <input
                                  type="checkbox"
                                  checked={selectedColumns.has(colId)}
                                  onChange={(e) => {
                                    e.stopPropagation();
                                    toggleColumnVisibility(colId, e.target.checked);
                                  }}
                                  className="rounded border-gray-300"
                                />
                                <span>{key}</span>
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Status Data Group */}
                  {stationData.length > 0 && Object.keys(columnStructure.status_data).length > 0 && (
                    <div className="border-b border-gray-200">
                      <button
                        onClick={(e) => {
                          // Prevent group toggle if clicking on checkbox
                          if (e.target instanceof HTMLElement && e.target.closest('.three-state-checkbox')) {
                            return;
                          }
                          handleGroupClick('status-data');
                        }}
                        className="w-full p-4 text-left hover:bg-gray-50 flex items-center justify-between"
                      >
                        <div className="flex items-center space-x-2">
                          <span className="text-gray-400">
                            {expandedGroup === 'status-data' ? '▼' : '▶'}
                          </span>
                          <div className="three-state-checkbox" onClick={(e) => e.stopPropagation()}>
                            <ThreeStateCheckbox
                              state={getGroupState('status-data')}
                              onChange={(checked) => {
                                toggleColumnGroup('status-data', checked);
                              }}
                            />
                          </div>
                          <span className="font-medium text-gray-700">📊 Status Data ({Object.keys(columnStructure.status_data).length})</span>
                        </div>
                      </button>
                      {expandedGroup === 'status-data' && (
                        <div className="px-4 pb-4 space-y-2" onClick={(e) => e.stopPropagation()}>
                          {Object.keys(columnStructure.status_data).map(key => {
                            const colId = `status_data.${key}`;
                            return (
                              <label key={colId} className="flex items-center space-x-2 text-sm text-gray-600 ml-6">
                                <input
                                  type="checkbox"
                                  checked={selectedColumns.has(colId)}
                                  onChange={(e) => {
                                    e.stopPropagation();
                                    toggleColumnVisibility(colId, e.target.checked);
                                  }}
                                  className="rounded border-gray-300"
                                />
                                <span>{key}</span>
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Measurements Group */}
                  {stationData.length > 0 && Object.keys(columnStructure.measurements_data).length > 0 && (
                    <div className="border-b border-gray-200">
                      <button
                        onClick={(e) => {
                          // Prevent group toggle if clicking on checkbox
                          if (e.target instanceof HTMLElement && e.target.closest('.three-state-checkbox')) {
                            return;
                          }
                          handleGroupClick('measurements');
                        }}
                        className="w-full p-4 text-left hover:bg-gray-50 flex items-center justify-between"
                      >
                        <div className="flex items-center space-x-2">
                          <span className="text-gray-400">
                            {expandedGroup === 'measurements' ? '▼' : '▶'}
                          </span>
                          <div className="three-state-checkbox" onClick={(e) => e.stopPropagation()}>
                            <ThreeStateCheckbox
                              state={getGroupState('measurements')}
                              onChange={(checked) => {
                                toggleColumnGroup('measurements', checked);
                              }}
                            />
                          </div>
                          <span className="font-medium text-gray-700">📈 Measurements ({Object.keys(columnStructure.measurements_data).length})</span>
                        </div>
                      </button>
                      {expandedGroup === 'measurements' && (
                        <div className="px-4 pb-4 space-y-2" onClick={(e) => e.stopPropagation()}>
                          {Object.keys(columnStructure.measurements_data).map(key => {
                            const colId = `measurements_data.${key}`;
                            return (
                              <label key={colId} className="flex items-center space-x-2 text-sm text-gray-600 ml-6">
                                <input
                                  type="checkbox"
                                  checked={selectedColumns.has(colId)}
                                  onChange={(e) => {
                                    e.stopPropagation();
                                    toggleColumnVisibility(colId, e.target.checked);
                                  }}
                                  className="rounded border-gray-300"
                                />
                                <span>{key}</span>
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Desktop Table */}
            <div className="flex-1 ag-theme-alpine" style={{ height: '600px' }}>
              <AgGridReact
                columnDefs={columnDefs}
                rowData={filteredData}
                onGridReady={onGridReady}
                onModelUpdated={onModelUpdated}
                onFilterChanged={onFilterChanged}
                animateRows={false}
                onRowClicked={(event) => {
                  const id = event.data.id;
                  console.log('Row clicked, station ID:', id);
                  handleRowClick(id);
                }}
                suppressMenuHide={true}
                rowSelection="multiple"
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
          </div>

          {/* Mobile Overlay Layout */}
          <div className="lg:hidden">
            {/* Mobile Column Selector Overlay */}
            {showColumnSelector && (
              <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
                <div ref={mobileDropdownRef} className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[80vh] overflow-hidden">
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
                  
                  <div className="overflow-hidden">
                    {/* Station Group */}
                    <div className="border-b border-gray-200">
                      <button
                        onClick={(e) => {
                          // Prevent group toggle if clicking on checkbox
                          if (e.target instanceof HTMLElement && e.target.closest('.three-state-checkbox')) {
                            return;
                          }
                          handleGroupClick('station');
                        }}
                        className="w-full p-3 text-left hover:bg-gray-50 flex items-center justify-between"
                      >
                        <div className="flex items-center space-x-2">
                          <div className="three-state-checkbox" onClick={(e) => e.stopPropagation()}>
                            <ThreeStateCheckbox
                              state={getGroupState('station')}
                              onChange={(checked) => {
                                toggleColumnGroup('station', checked);
                              }}
                            />
                          </div>
                          <span className="font-medium text-gray-700">🏢 Station</span>
                        </div>
                        <span className="text-gray-400">
                          {expandedGroup === 'station' ? '▲' : '▼'}
                        </span>
                      </button>
                      {expandedGroup === 'station' && (
                        <div
                          className="px-3 pb-3 space-y-2 max-h-48 overflow-y-auto"
                        >
                          {/* Note: ID, Name, and Type are always pinned left and not configurable */}
                          {[
                            { id: 'label', label: 'Label' },
                            { id: 'latitude', label: 'Latitude' },
                            { id: 'longitude', label: 'Longitude' },
                            { id: 'altitude', label: 'Altitude' },
                            { id: 'ip_address', label: 'IP Address' },
                            { id: 'sms_number', label: 'SMS Number' },
                            { id: 'online_24h_avg', label: 'Online 24h Avg' },
                            { id: 'online_7d_avg', label: 'Online 7d Avg' },
                            { id: 'online_24h_graph', label: 'Online 24h Graph' },
                            { id: 'online_last_seen', label: 'Online Last Seen' },
                            { id: 'data_health_24h_avg', label: 'Data Health 24h Avg' },
                            { id: 'data_health_7d_avg', label: 'Data Health 7d Avg' },
                          ].map(({ id, label }) => (
                            <label key={id} className="flex items-center space-x-2 text-sm text-gray-600 ml-6">
                              <input
                                type="checkbox"
                                checked={selectedColumns.has(id)}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  toggleColumnVisibility(id, e.target.checked);
                                }}
                                className="rounded border-gray-300"
                              />
                              <span>{label}</span>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Public Data Group */}
                    {stationData.length > 0 && Object.keys(columnStructure.public_data).length > 0 && (
                      <div className="border-b border-gray-200">
                        <button
                          onClick={(e) => {
                            // Prevent group toggle if clicking on checkbox
                            if (e.target instanceof HTMLElement && e.target.closest('.three-state-checkbox')) {
                              return;
                            }
                            handleGroupClick('public-data');
                          }}
                          className="w-full p-3 text-left hover:bg-gray-50 flex items-center justify-between"
                        >
                          <div className="flex items-center space-x-2">
                            <div className="three-state-checkbox" onClick={(e) => e.stopPropagation()}>
                              <ThreeStateCheckbox
                                state={getGroupState('public-data')}
                                onChange={(checked) => {
                                  toggleColumnGroup('public-data', checked);
                                }}
                              />
                            </div>
                            <span className="font-medium text-gray-700">🌐 Public Data ({Object.keys(columnStructure.public_data).length})</span>
                          </div>
                          <span className="text-gray-400">
                            {expandedGroup === 'public-data' ? '▲' : '▼'}
                          </span>
                        </button>
                        {expandedGroup === 'public-data' && (
                          <div className="px-3 pb-3 space-y-2 max-h-48 overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                            {Object.keys(columnStructure.public_data).map(key => {
                              const colId = `public_data.${key}`;
                              return (
                                <label key={colId} className="flex items-center space-x-2 text-sm text-gray-600 ml-6">
                                  <input
                                    type="checkbox"
                                    checked={selectedColumns.has(colId)}
                                    onChange={(e) => {
                                      e.stopPropagation();
                                      toggleColumnVisibility(colId, e.target.checked);
                                    }}
                                    className="rounded border-gray-300"
                                  />
                                  <span>{key}</span>
                                </label>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Status Data Group */}
                    {stationData.length > 0 && Object.keys(columnStructure.status_data).length > 0 && (
                      <div className="border-b border-gray-200">
                        <button
                          onClick={(e) => {
                            // Prevent group toggle if clicking on checkbox
                            if (e.target instanceof HTMLElement && e.target.closest('.three-state-checkbox')) {
                              return;
                            }
                            handleGroupClick('status-data');
                          }}
                          className="w-full p-3 text-left hover:bg-gray-50 flex items-center justify-between"
                        >
                          <div className="flex items-center space-x-2">
                            <div className="three-state-checkbox" onClick={(e) => e.stopPropagation()}>
                              <ThreeStateCheckbox
                                state={getGroupState('status-data')}
                                onChange={(checked) => {
                                  toggleColumnGroup('status-data', checked);
                                }}
                              />
                            </div>
                            <span className="font-medium text-gray-700">📊 Status Data ({Object.keys(columnStructure.status_data).length})</span>
                          </div>
                          <span className="text-gray-400">
                            {expandedGroup === 'status-data' ? '▲' : '▼'}
                          </span>
                        </button>
                        {expandedGroup === 'status-data' && (
                          <div className="px-3 pb-3 space-y-2 max-h-48 overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                            {Object.keys(columnStructure.status_data).map(key => {
                              const colId = `status_data.${key}`;
                              return (
                                <label key={colId} className="flex items-center space-x-2 text-sm text-gray-600 ml-6">
                                  <input
                                    type="checkbox"
                                    checked={selectedColumns.has(colId)}
                                    onChange={(e) => {
                                      e.stopPropagation();
                                      toggleColumnVisibility(colId, e.target.checked);
                                    }}
                                    className="rounded border-gray-300"
                                  />
                                  <span>{key}</span>
                                </label>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Measurements Group */}
                    {stationData.length > 0 && Object.keys(columnStructure.measurements_data).length > 0 && (
                      <div className="border-b border-gray-200">
                        <button
                          onClick={(e) => {
                            // Prevent group toggle if clicking on checkbox
                            if (e.target instanceof HTMLElement && e.target.closest('.three-state-checkbox')) {
                              return;
                            }
                            handleGroupClick('measurements');
                          }}
                          className="w-full p-3 text-left hover:bg-gray-50 flex items-center justify-between"
                        >
                          <div className="flex items-center space-x-2">
                            <div className="three-state-checkbox" onClick={(e) => e.stopPropagation()}>
                              <ThreeStateCheckbox
                                state={getGroupState('measurements')}
                                onChange={(checked) => {
                                  toggleColumnGroup('measurements', checked);
                                }}
                              />
                            </div>
                            <span className="font-medium text-gray-700">📈 Measurements ({Object.keys(columnStructure.measurements_data).length})</span>
                          </div>
                          <span className="text-gray-400">
                            {expandedGroup === 'measurements' ? '▲' : '▼'}
                          </span>
                        </button>
                        {expandedGroup === 'measurements' && (
                          <div className="px-3 pb-3 space-y-2 max-h-48 overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                            {Object.keys(columnStructure.measurements_data).map(key => {
                              const colId = `measurements_data.${key}`;
                              return (
                                <label key={colId} className="flex items-center space-x-2 text-sm text-gray-600 ml-6">
                                  <input
                                    type="checkbox"
                                    checked={selectedColumns.has(colId)}
                                    onChange={(e) => {
                                      e.stopPropagation();
                                      toggleColumnVisibility(colId, e.target.checked);
                                    }}
                                    className="rounded border-gray-300"
                                  />
                                  <span>{key}</span>
                                </label>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Mobile Table */}
            <div className="ag-theme-alpine" style={{ height: '600px', width: '100%' }}>
              <AgGridReact
                columnDefs={columnDefs}
                rowData={filteredData}
                onGridReady={onGridReady}
                onModelUpdated={onModelUpdated}
                onFilterChanged={onFilterChanged}
                animateRows={false}
                onRowClicked={(event) => {
                  const id = event.data.id;
                  console.log('Row clicked, station ID:', id);
                  handleRowClick(id);
                }}
                suppressMenuHide={true}
                rowSelection="multiple"
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
          </div>

          {/* Footer */}
          <div className="mt-4 flex items-center justify-end">
            <p className="text-sm text-gray-600">
              Rows: {filteredCount} of {rowCount} {isFiltered && '(Filtered)'}
            </p>
          </div>
        </>
      )}
    </div>
  );
}
