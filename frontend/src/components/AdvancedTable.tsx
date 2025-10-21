'use client'

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { AgGridReact } from 'ag-grid-react';
import api from '@/utils/api';
import {
  ModuleRegistry,
  AllCommunityModule,
  ColDef,
  GridReadyEvent,
  GridApi
} from 'ag-grid-community';
import { AdvancedStationData } from '@/types/station';
import { useRouter } from 'next/navigation';
import * as ExcelJS from 'exceljs';
import ThreeStateCheckbox from './ThreeStateCheckbox';
import TimelineCell from './TimelineCell';
import { useAdvancedTablePersistence } from '@/hooks/useAdvancedTablePersistence';

ModuleRegistry.registerModules([AllCommunityModule]);

interface AdvancedTableProps {
  readonly className?: string;
  readonly height?: string;
  readonly onRowClick?: (stationId: number) => void;
  readonly defaultSelectedColumns?: readonly string[];
  readonly showControls?: boolean;
}

export default function AdvancedTable({
  className = "",
  height = "",
  onRowClick,
  defaultSelectedColumns = [
    'label', 'ip_address', 'online_24h_avg', 'data_health_24h_avg',
    'latitude', 'longitude', 'altitude', 'sms_number'
  ],
  showControls = true
}: AdvancedTableProps) {
  const router = useRouter();
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
  const [selectedColumns, setSelectedColumns] = useState<Set<string>>(new Set());
  const [showExportDropdown, setShowExportDropdown] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedGroup, setExpandedGroup] = useState<string>('');
  const [isMobile, setIsMobile] = useState(false);
  
  const columnSelectorRef = useRef<HTMLDivElement>(null);
  const exportDropdownRef = useRef<HTMLDivElement>(null);
  const desktopColumnPanelRef = useRef<HTMLDivElement>(null);
  const mobileColumnDropdownRef = useRef<HTMLDivElement>(null);

  // Mobile detection hook
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024); // lg breakpoint in Tailwind
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Persistence hook for saving/loading table state
  const {
    loadState,
    saveGridState,
    restoreGridState,
    saveComponentState
  } = useAdvancedTablePersistence();

  // Fetch station data
  useEffect(() => {
    const fetchStationData = async () => {
      try {
        setLoading(true);
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
        
        if (res.data?.stations) {
          const stations = res.data.stations;
          setStationData(stations);
          
          // Use column structure from response
          if (res.data.columnStructure) {
            setColumnStructure(res.data.columnStructure);
          }
        } else {
          throw new Error('Invalid response format');
        }
      } catch (error) {
        console.error('Error fetching station data:', error);
        setError('Failed to load station data');
      } finally {
        setLoading(false);
      }
    };

    // Initial load
    fetchStationData();

    // Set up automatic refresh every 10 minutes (600,000 ms) - consistent with network page
    const refreshInterval = setInterval(() => {
      console.log('Auto-refreshing advanced table data...');
      fetchStationData();
    }, 10 * 60 * 1000);

    // Cleanup interval on component unmount
    return () => {
      clearInterval(refreshInterval);
    };
  }, []);

  // Load persisted state on component mount
  useEffect(() => {
    const persistedState = loadState();
    
    if (persistedState.selectedColumns && persistedState.selectedColumns.length > 0) {
      setSelectedColumns(new Set(persistedState.selectedColumns));
    } else {
      // Use default columns if no persisted state exists
      setSelectedColumns(new Set(defaultSelectedColumns));
    }
    
    if (persistedState.searchTerm) {
      setSearchTerm(persistedState.searchTerm);
    }
    
    if (persistedState.expandedGroup) {
      setExpandedGroup(persistedState.expandedGroup);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadState]); // Intentionally excluding defaultSelectedColumns to prevent infinite loop

  // Save component state when it changes (only after selectedColumns is initialized)
  useEffect(() => {
    // Don't save if selectedColumns is empty (not yet initialized)
    if (selectedColumns.size === 0) return;
    
    saveComponentState({
      selectedColumns: Array.from(selectedColumns),
      searchTerm,
      expandedGroup,
    });
  }, [selectedColumns, searchTerm, expandedGroup, saveComponentState]);

  // Filter data based on search term
  const filteredData = useMemo(() => {
    if (!searchTerm.trim()) {
      return stationData;
    }

    const term = searchTerm.toLowerCase();
    return stationData.filter(station => {
      // Search in basic fields
      const basicFields = [
        station.label_name,
        station.label_type,
        station.label,
        station.ip,
        station.sms_number,
        String(station.label_id)
      ];

      // Search in public_data
      const publicValues = Object.values(station.public_data || {});
      
      // Search in status_data  
      const statusValues = Object.values(station.status_data || {});
      
      // Search in measurements_data
      const measurementValues = Object.values(station.measurements_data || {});

      const allValues = [
        ...basicFields,
        ...publicValues,
        ...statusValues,
        ...measurementValues
      ].filter(val => val != null);

      return allValues.some(value => 
        String(value).toLowerCase().includes(term)
      );
    });
  }, [stationData, searchTerm]);

  // Update counts when grid changes
  const updateCounts = useCallback(() => {
    if (!gridApi) return;
    
    const totalRows = stationData.length;
    const displayedRowCount = gridApi.getDisplayedRowCount();
    const gridFilterModel = gridApi.getFilterModel();
    const hasGridFilters = Object.keys(gridFilterModel).length > 0;
    const hasSearchFilter = Boolean(searchTerm.trim());
    const isCurrentlyFiltered = hasGridFilters || hasSearchFilter;
    
    setRowCount(totalRows);
    setFilteredCount(displayedRowCount);
    setIsFiltered(isCurrentlyFiltered);
  }, [gridApi, stationData.length, searchTerm]);

  // Grid event handlers
  const onFilterChanged = useCallback(() => {
    // Let onModelUpdated handle the count updates
  }, []);

  const onModelUpdated = useCallback(() => {
    if (gridApi) {
      setTimeout(() => {
        updateCounts();
      }, 0);
    }
  }, [gridApi, updateCounts]);

  const onGridReady = useCallback((params: GridReadyEvent) => {
    setGridApi(params.api);
    
    // Restore grid state after a short delay to ensure columns are ready
    setTimeout(() => {
      restoreGridState(params.api, isMobile);
      updateCounts();
    }, 100);
  }, [updateCounts, restoreGridState, isMobile]);

  // Save grid state when filters/sorts change
  useEffect(() => {
    if (gridApi) {
      const handleFilterChanged = () => {
        saveGridState(gridApi);
        updateCounts();
      };

      const handleSortChanged = () => {
        saveGridState(gridApi);
      };

      gridApi.addEventListener('filterChanged', handleFilterChanged);
      gridApi.addEventListener('sortChanged', handleSortChanged);

      return () => {
        gridApi.removeEventListener('filterChanged', handleFilterChanged);
        gridApi.removeEventListener('sortChanged', handleSortChanged);
      };
    }
  }, [gridApi, saveGridState, updateCounts]);

  // Handle row click
  const handleRowClick = useCallback((stationId: number) => {
    if (onRowClick) {
      onRowClick(stationId);
    } else {
      router.push(`/station/${stationId}`);
    }
  }, [onRowClick, router]);

  // Column visibility management
  const toggleColumnVisibility = useCallback((columnId: string, isVisible: boolean) => {
    setSelectedColumns(prev => {
      const newSet = new Set(prev);
      if (isVisible) {
        newSet.add(columnId);
      } else {
        newSet.delete(columnId);
      }
      return newSet;
    });
  }, []);

  // Toggle column group selection
  const toggleColumnGroup = useCallback((groupName: string, isVisible: boolean) => {
    if (stationData.length === 0) return;

    const publicKeys = Object.keys(columnStructure.public_data);
    const statusKeys = Object.keys(columnStructure.status_data);
    const measurementKeys = Object.keys(columnStructure.measurements_data);
    
    let columnsToToggle: string[] = [];
    
    switch (groupName) {
      case 'station':
        // Exclude pinned columns (label_id, label_name, label_type) - they're pinned on desktop but configurable on mobile
        columnsToToggle = [
          'label', 'latitude', 'longitude', 'altitude', 
          'ip_address', 'sms_number', 'online_24h_avg', 'online_7d_avg', 'online_24h_graph', 
          'online_last_seen', 'data_health_24h_avg', 'data_health_7d_avg'
        ];
        break;
      case 'public-data':
        // Include public_timestamp first, then other keys
        columnsToToggle = ['public_timestamp', ...publicKeys.map(key => `public_data.${key}`)];
        break;
      case 'status-data':
        // Include status_timestamp first, then other keys
        columnsToToggle = ['status_timestamp', ...statusKeys.map(key => `status_data.${key}`)];
        break;
      case 'measurements':
        // Include measurements_timestamp first, then other keys
        columnsToToggle = ['measurements_timestamp', ...measurementKeys.map(key => `measurements_data.${key}`)];
        break;
    }
    
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
  }, [stationData, columnStructure]);

  // Helper function to get group selection state (fully selected, partially selected, or not selected)
  const getGroupState = useCallback((groupName: string): 'all' | 'some' | 'none' => {
    if (stationData.length === 0) return 'none';

    const publicKeys = Object.keys(columnStructure.public_data);
    const statusKeys = Object.keys(columnStructure.status_data);
    const measurementKeys = Object.keys(columnStructure.measurements_data);
    let columnsInGroup: string[] = [];

    switch (groupName) {
      case 'station':
        // Exclude pinned columns (label_id, label_name, label_type) - they're pinned on desktop but configurable on mobile
        columnsInGroup = [
          'label', 'latitude', 'longitude', 'altitude', 
          'ip_address', 'sms_number', 'online_24h_avg', 'online_7d_avg', 'online_24h_graph', 
          'online_last_seen', 'data_health_24h_avg', 'data_health_7d_avg'
        ];
        break;
      case 'public-data':
        // Include public_timestamp first, then other keys
        columnsInGroup = ['public_timestamp', ...publicKeys.map(key => `public_data.${key}`)];
        break;
      case 'status-data':
        // Include status_timestamp first, then other keys
        columnsInGroup = ['status_timestamp', ...statusKeys.map(key => `status_data.${key}`)];
        break;
      case 'measurements':
        // Include measurements_timestamp first, then other keys
        columnsInGroup = ['measurements_timestamp', ...measurementKeys.map(key => `measurements_data.${key}`)];
        break;
    }

    if (columnsInGroup.length === 0) return 'none';
    
    const selectedCount = columnsInGroup.filter(colId => selectedColumns.has(colId)).length;
    
    if (selectedCount === columnsInGroup.length) return 'all';
    if (selectedCount > 0) return 'some';
    return 'none';
  }, [stationData, columnStructure, selectedColumns]);

  // Handle group expansion/collapse
  const handleGroupClick = useCallback((groupName: string) => {
    const isOpening = expandedGroup !== groupName;
    setExpandedGroup(expandedGroup === groupName ? '' : groupName);
    
    // Reset scroll position to top when opening a group
    if (isOpening) {
      // Reset scroll for desktop dropdown
      const desktopScrollContainer = desktopColumnPanelRef.current?.querySelector('.flex-1.overflow-y-auto');
      if (desktopScrollContainer) {
        desktopScrollContainer.scrollTop = 0;
      }
      
      // Reset scroll for mobile dropdown  
      const mobileScrollContainer = mobileColumnDropdownRef.current?.querySelector('.overflow-hidden');
      if (mobileScrollContainer) {
        mobileScrollContainer.scrollTop = 0;
      }
    }
  }, [expandedGroup]);

  const showAllColumns = useCallback(() => {
    const allColumnIds = new Set([
      // Basic columns
      'label', 'latitude', 'longitude', 'altitude', 'ip_address', 'sms_number',
      'online_24h_avg', 'online_7d_avg', 'online_24h_graph', 'online_last_seen',
      'data_health_24h_avg', 'data_health_7d_avg',
      // Timestamp columns
      'public_timestamp', 'status_timestamp', 'measurements_timestamp',
      // Public data columns
      ...Object.keys(columnStructure.public_data).map(key => `public_data.${key}`),
      // Status data columns  
      ...Object.keys(columnStructure.status_data).map(key => `status_data.${key}`),
      // Measurements columns
      ...Object.keys(columnStructure.measurements_data).map(key => `measurements_data.${key}`)
    ]);
    setSelectedColumns(allColumnIds);
  }, [columnStructure]);

  const hideAllColumns = useCallback(() => {
    setSelectedColumns(new Set());
  }, []);

  // Comprehensive reset function
  const resetToDefault = useCallback(() => {
    // Reset search
    setSearchTerm('');
    
    // Reset to basic view (default columns)
    setSelectedColumns(new Set(defaultSelectedColumns));
    
    // Reset grid filters and sorts if gridApi is available
    if (gridApi) {
      // Reset all column filters
      gridApi.setFilterModel({});
      // Reset all sorting
      gridApi.applyColumnState({
        defaultState: { sort: null }
      });
    }
  }, [gridApi, defaultSelectedColumns]);

  // Export functionality
  const exportToExcel = useCallback(async () => {
    if (!gridApi) return;

    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Station Data');
      
      const visibleColumns = gridApi.getColumnDefs()?.filter(col => {
        const colDef = col as ColDef;
        const colId = colDef.field;
        return colId && !(colDef as ColDef & {hide?: boolean}).hide;
      }) as ColDef[];

      if (!visibleColumns?.length) return;

      // Add headers
      const headers = visibleColumns.map(col => col.headerName || col.field || '');
      worksheet.addRow(headers);

      // Get displayed data (respects filters)
      const rowData: AdvancedStationData[] = [];
      gridApi.forEachNodeAfterFilterAndSort((node) => {
        if (node.data) rowData.push(node.data);
      });

      // Add data rows
      rowData.forEach(row => {
        const rowValues = visibleColumns.map(col => {
          const field = col.field;
          if (!field) return '';
          
          let value = (row as unknown as Record<string, unknown>)[field];
          
          // Handle nested object fields
          if (field.includes('.')) {
            const parts = field.split('.');
            value = (row as unknown as Record<string, Record<string, unknown>>)[parts[0]]?.[parts[1]];
          }
          
          return value ?? '';
        });
        worksheet.addRow(rowValues);
      });

      // Style headers
      const headerRow = worksheet.getRow(1);
      headerRow.font = { bold: true };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' }
      };

      // Auto-fit columns
      worksheet.columns.forEach((column, index) => {
        const header = headers[index];
        const maxLength = Math.max(
          header?.length || 0,
          15 // minimum width
        );
        column.width = Math.min(maxLength * 1.2, 50); // max width of 50
      });

      // Generate and download file
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
      });
      
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `station_data_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      setShowExportDropdown(false);
    } catch (error) {
      console.error('Export failed:', error);
    }
  }, [gridApi]);

  const exportToCSV = useCallback(() => {
    if (gridApi) {
      gridApi.exportDataAsCsv({
        fileName: `station_data_${new Date().toISOString().split('T')[0]}.csv`,
        onlySelected: false
      });
      setShowExportDropdown(false);
    }
  }, [gridApi]);

  // Click outside handlers
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      
      // Column selector can only be closed by clicking the Columns button
      // No outside click handling for column selector
      
      // Handle export dropdown
      if (exportDropdownRef.current && !exportDropdownRef.current.contains(target)) {
        setShowExportDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showColumnSelector]);

  // Generate column definitions
  const columnDefs = useMemo((): ColDef[] => {
    if (stationData.length === 0 || !columnStructure.public_data || Object.keys(columnStructure.public_data).length === 0) return [];

    const columns: ColDef[] = [];

    // Always include basic columns (pinned on desktop, not pinned on mobile)
    columns.push({
      headerName: 'ID',
      field: 'label_id',
      pinned: isMobile ? undefined : 'left',
      minWidth: 80,
      maxWidth: 100,
      cellStyle: { fontWeight: '600' },
      filter: 'agNumberColumnFilter',
      filterParams: { buttons: ['reset', 'apply'] }
    });

    columns.push({
      headerName: 'Name',
      field: 'label_name',
      pinned: isMobile ? undefined : 'left',
      minWidth: 200,
      flex: 1,
      cellStyle: { fontWeight: '600', fontSize: '16px' },
      filter: 'agTextColumnFilter',
      filterParams: { buttons: ['reset', 'apply'], debounceMs: 300 }
    });

    columns.push({
      headerName: 'Type',
      field: 'label_type',
      pinned: isMobile ? undefined : 'left',
      minWidth: 100,
      maxWidth: 120,
      filter: 'agTextColumnFilter',
      filterParams: { buttons: ['reset', 'apply'] }
    });

    // Add configurable columns based on selection
    if (selectedColumns.has('label')) {
      columns.push({
        headerName: 'Label',
        field: 'label',
        minWidth: 150,
        filter: 'agTextColumnFilter',
        filterParams: { buttons: ['reset', 'apply'], debounceMs: 300 }
      });
    }

    if (selectedColumns.has('latitude')) {
      columns.push({
        headerName: 'Latitude',
        field: 'latitude',
        minWidth: 120,
        valueFormatter: params => params.value ? params.value.toFixed(6) : '',
        filter: 'agNumberColumnFilter',
        filterParams: { buttons: ['reset', 'apply'] }
      });
    }

    if (selectedColumns.has('longitude')) {
      columns.push({
        headerName: 'Longitude',
        field: 'longitude',
        minWidth: 120,
        valueFormatter: params => params.value ? params.value.toFixed(6) : '',
        filter: 'agNumberColumnFilter',
        filterParams: { buttons: ['reset', 'apply'] }
      });
    }

    if (selectedColumns.has('altitude')) {
      columns.push({
        headerName: 'Altitude',
        field: 'altitude',
        minWidth: 100,
        valueFormatter: params => params.value ? `${params.value}m` : '',
        filter: 'agNumberColumnFilter',
        filterParams: { buttons: ['reset', 'apply'] }
      });
    }

    if (selectedColumns.has('ip_address')) {
      columns.push({
        headerName: 'IP Address',
        field: 'ip',
        minWidth: 150,
        filter: 'agTextColumnFilter',
        filterParams: { buttons: ['reset', 'apply'] }
      });
    }

    if (selectedColumns.has('sms_number')) {
      columns.push({
        headerName: 'SMS Number',
        field: 'sms_number',
        minWidth: 150,
        filter: 'agTextColumnFilter',
        filterParams: { buttons: ['reset', 'apply'] }
      });
    }

    // Health/status columns
    if (selectedColumns.has('online_24h_avg')) {
      columns.push({
        headerName: 'Online_24h_Avg',
        field: 'avg_fetch_health_24h',
        minWidth: 120,
        maxWidth: 150,
        valueFormatter: params => params.value != null ? `${params.value}%` : '',
        filter: 'agNumberColumnFilter',
        filterParams: { buttons: ['reset', 'apply'] }
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
        filterParams: { buttons: ['reset', 'apply'] }
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
        minWidth: 120,
        maxWidth: 180,
        valueFormatter: params => params.value != null ? `${params.value}%` : '',
        filter: 'agNumberColumnFilter',
        filterParams: { buttons: ['reset', 'apply'] }
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
        filterParams: { buttons: ['reset', 'apply'] }
      });
    }

    // Public timestamp column
    if (selectedColumns.has('public_timestamp')) {
      columns.push({
        headerName: 'Public: Timestamp',
        field: 'public_timestamp',
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

    // Dynamic public data columns
    Object.keys(columnStructure.public_data).forEach(key => {
      const colId = `public_data.${key}`;
      if (selectedColumns.has(colId)) {
        // Check if the value is numeric by sampling multiple stations (some might not have data)
        let isNumeric = false;
        for (const station of stationData) {
          const sampleValue = station?.public_data?.[key];
          if (sampleValue !== undefined && sampleValue !== null && sampleValue !== '' && !Array.isArray(sampleValue) && sampleValue !== 'NaN') {
            const numValue = Number(sampleValue);
            if (!isNaN(numValue)) {
              isNumeric = true;
              break; // Found a valid numeric sample, use it to determine filter type
            }
          }
        }
        
        columns.push({
          headerName: `Public: ${key}`,
          field: colId,
          minWidth: 120,
          valueGetter: params => params.data?.public_data?.[key] || '',
          comparator: isNumeric ? (valueA, valueB) => {
            const numA = (valueA === undefined || valueA === null || valueA === '' || valueA === 'NaN' || isNaN(Number(valueA))) ? -Infinity : Number(valueA);
            const numB = (valueB === undefined || valueB === null || valueB === '' || valueB === 'NaN' || isNaN(Number(valueB))) ? -Infinity : Number(valueB);
            return numA - numB;
          } : undefined,
          filter: isNumeric ? 'agNumberColumnFilter' : 'agTextColumnFilter',
          filterParams: {
            buttons: ['reset', 'apply'],
          }
        });
      }
    });

    // Status timestamp column
    if (selectedColumns.has('status_timestamp')) {
      columns.push({
        headerName: 'Status: Timestamp',
        field: 'status_timestamp',
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

    // Dynamic status data columns
    Object.keys(columnStructure.status_data).forEach(key => {
      const colId = `status_data.${key}`;
      if (selectedColumns.has(colId)) {
        // Check if the value is numeric by sampling multiple stations (some might not have data)
        let isNumeric = false;
        for (const station of stationData) {
          const sampleValue = station?.status_data?.[key];
          if (sampleValue !== undefined && sampleValue !== null && sampleValue !== '' && !Array.isArray(sampleValue) && sampleValue !== 'NaN') {
            const numValue = Number(sampleValue);
            if (!isNaN(numValue)) {
              isNumeric = true;
              break; // Found a valid numeric sample, use it to determine filter type
            }
          }
        }
        
        columns.push({
          headerName: `Status: ${key}`,
          field: colId,
          minWidth: 120,
          valueGetter: params => params.data?.status_data?.[key] || '',
          comparator: isNumeric ? (valueA, valueB) => {
            // Convert values to numbers for sorting, treating invalid values as -Infinity (sorts to bottom)
            const numA = (valueA === undefined || valueA === null || valueA === '' || valueA === 'NaN' || isNaN(Number(valueA))) ? -Infinity : Number(valueA);
            const numB = (valueB === undefined || valueB === null || valueB === '' || valueB === 'NaN' || isNaN(Number(valueB))) ? -Infinity : Number(valueB);
            return numA - numB;
          } : undefined,
          filter: isNumeric ? 'agNumberColumnFilter' : 'agTextColumnFilter',
          filterParams: {
            buttons: ['reset', 'apply'],
          }
        });
      }
    });

    // Measurements timestamp
    if (selectedColumns.has('measurements_timestamp')) {
      columns.push({
        headerName: 'Measurements: Timestamp',
        field: 'measurements_timestamp',
        minWidth: 180,
        valueFormatter: params => {
          if (!params.value) return '';
          try {
            return new Date(params.value).toLocaleString();
          } catch {
            return params.value;
          }
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

    // Dynamic measurements data columns
    Object.keys(columnStructure.measurements_data).forEach(key => {
      const colId = `measurements_data.${key}`;
      if (selectedColumns.has(colId)) {
        // Check if the value is numeric by sampling multiple stations (some might not have data)
        let isNumeric = false;
        for (const station of stationData) {
          const sampleValue = station?.measurements_data?.[key];
          if (sampleValue !== undefined && sampleValue !== null && sampleValue !== '' && !Array.isArray(sampleValue) && sampleValue !== 'NaN') {
            const numValue = Number(sampleValue);
            if (!isNaN(numValue)) {
              isNumeric = true;
              break; // Found a valid numeric sample, use it to determine filter type
            }
          }
        }
        
        columns.push({
          headerName: `Measurements: ${key}`,
          field: colId,
          minWidth: 120,
          valueGetter: params => params.data?.measurements_data?.[key] || '',
          comparator: isNumeric ? (valueA, valueB) => {
            // Convert values to numbers for sorting, treating invalid values as -Infinity (sorts to bottom)
            const numA = (valueA === undefined || valueA === null || valueA === '' || valueA === 'NaN' || isNaN(Number(valueA))) ? -Infinity : Number(valueA);
            const numB = (valueB === undefined || valueB === null || valueB === '' || valueB === 'NaN' || isNaN(Number(valueB))) ? -Infinity : Number(valueB);
            return numA - numB;
          } : undefined,
          filter: isNumeric ? 'agNumberColumnFilter' : 'agTextColumnFilter',
          filterParams: {
            buttons: ['reset', 'apply'],
          }
        });
      }
    });

    return columns;
  }, [selectedColumns, columnStructure, stationData, isMobile]);

  // Update column pinning when mobile state changes
  useEffect(() => {
    if (gridApi) {
      // Force update the pinning of basic columns based on mobile state
      const currentColumnState = gridApi.getColumnState();
      const updatedColumnState = currentColumnState.map(col => {
        if (col.colId === 'label_id' || col.colId === 'label_name' || col.colId === 'label_type') {
          return { ...col, pinned: isMobile ? null : 'left' as const };
        }
        return col;
      });
      
      gridApi.applyColumnState({
        state: updatedColumnState,
        applyOrder: true,
      });
    }
  }, [gridApi, isMobile]);

  if (loading) {
    return (
      <div className={`flex items-center justify-center ${className}`} style={{ height:'720px' }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading station data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`flex items-center justify-center ${className}`} style={{ height:'720px' }}>
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col ${className}`}>
      {/* Controls Section */}
      {showControls && (
        <div className="mb-4">
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm max-w-5xl mx-auto p-4">
            {/* Mobile layout - 2 rows */}
            <div className="flex flex-col gap-4 md:hidden">
              {/* First row: Columns button and search */}
              <div className="flex items-center gap-3">
                {/* Column Selector */}
                <div className="relative" ref={columnSelectorRef}>
                  <button
                    onClick={() => setShowColumnSelector(!showColumnSelector)}
                    className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 whitespace-nowrap"
                  >
                    Columns
                  </button>
              
              {/* Mobile Column Dropdown (only show on smaller screens when desktop side panel is not visible) */}
              {showColumnSelector && (
                <div 
                  ref={mobileColumnDropdownRef}
                  className="lg:hidden absolute left-0 mt-2 w-80 bg-white rounded-lg shadow-xl border border-gray-200 z-50 max-h-96 overflow-y-auto"
                >
                  <div className="p-4 border-b border-gray-200">
                    <div className="flex gap-2 mb-3">
                      <button
                        onClick={showAllColumns}
                        className="px-3 py-1.5 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
                      >
                        Show All
                      </button>
                      <button
                        onClick={hideAllColumns}
                        className="px-3 py-1.5 text-xs bg-gray-500 text-white rounded hover:bg-gray-600"
                      >
                        Hide All
                      </button>
                    </div>
                  </div>
                  <div className="max-h-64 overflow-y-auto p-4 space-y-2">
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
                        className="w-full p-2 text-left hover:bg-gray-50 flex items-center justify-between"
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
                        <div className="px-2 pb-2 space-y-1" onClick={(e) => e.stopPropagation()}>
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
                            <label key={id} className="flex items-center space-x-2 text-sm text-gray-600 ml-4">
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
                            if (e.target instanceof HTMLElement && e.target.closest('.three-state-checkbox')) {
                              return;
                            }
                            handleGroupClick('public-data');
                          }}
                          className="w-full p-2 text-left hover:bg-gray-50 flex items-center justify-between"
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
                          <div className="px-2 pb-2 space-y-1" onClick={(e) => e.stopPropagation()}>
                            <label className="flex items-center space-x-2 text-sm text-gray-600 ml-4">
                              <input
                                type="checkbox"
                                checked={selectedColumns.has('public_timestamp')}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  toggleColumnVisibility('public_timestamp', e.target.checked);
                                }}
                                className="rounded border-gray-300"
                              />
                              <span className="font-medium">📅 Timestamp</span>
                            </label>
                            {Object.keys(columnStructure.public_data).map(key => {
                              const colId = `public_data.${key}`;
                              return (
                                <label key={colId} className="flex items-center space-x-2 text-sm text-gray-600 ml-4">
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
                            if (e.target instanceof HTMLElement && e.target.closest('.three-state-checkbox')) {
                              return;
                            }
                            handleGroupClick('status-data');
                          }}
                          className="w-full p-2 text-left hover:bg-gray-50 flex items-center justify-between"
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
                          <div className="px-2 pb-2 space-y-1" onClick={(e) => e.stopPropagation()}>
                            <label className="flex items-center space-x-2 text-sm text-gray-600 ml-4">
                              <input
                                type="checkbox"
                                checked={selectedColumns.has('status_timestamp')}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  toggleColumnVisibility('status_timestamp', e.target.checked);
                                }}
                                className="rounded border-gray-300"
                              />
                              <span className="font-medium">📅 Timestamp</span>
                            </label>
                            {Object.keys(columnStructure.status_data).map(key => {
                              const colId = `status_data.${key}`;
                              return (
                                <label key={colId} className="flex items-center space-x-2 text-sm text-gray-600 ml-4">
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
                    <div>
                      <button
                        onClick={(e) => {
                          if (e.target instanceof HTMLElement && e.target.closest('.three-state-checkbox')) {
                            return;
                          }
                          handleGroupClick('measurements');
                        }}
                        className="w-full p-2 text-left hover:bg-gray-50 flex items-center justify-between"
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
                          <span className="font-medium text-gray-700">📋 Measurements ({Object.keys(columnStructure.measurements_data).length})</span>
                        </div>
                      </button>
                      {expandedGroup === 'measurements' && (
                        <div className="px-2 pb-2 space-y-1" onClick={(e) => e.stopPropagation()}>
                          <label className="flex items-center space-x-2 text-sm text-gray-600 ml-4">
                            <input
                              type="checkbox"
                              checked={selectedColumns.has('measurements_timestamp')}
                              onChange={(e) => {
                                e.stopPropagation();
                                toggleColumnVisibility('measurements_timestamp', e.target.checked);
                              }}
                              className="rounded border-gray-300"
                            />
                            <span className="font-medium">📅 Timestamp</span>
                          </label>
                          {Object.keys(columnStructure.measurements_data).map(key => {
                            const colId = `measurements_data.${key}`;
                            return (
                              <label key={colId} className="flex items-center space-x-2 text-sm text-gray-600 ml-4">
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
                  </div>
                </div>
              )}
            </div>

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
              </div>

              {/* Second row: Reset, station count, and export */}
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  {/* Reset Button */}
                  <button
                    onClick={resetToDefault}
                    className="text-sm text-gray-500 hover:text-gray-700 underline whitespace-nowrap"
                  >
                    Reset
                  </button>

                  <div className="text-sm text-gray-600 whitespace-nowrap">
                    {isFiltered ? (
                      <>Showing {filteredCount} of {rowCount} stations</>
                    ) : (
                      <>{rowCount} stations</>
                    )}
                  </div>
                </div>

                {/* Export Button */}
                <div className="relative" ref={exportDropdownRef}>
                  <button
                    onClick={() => setShowExportDropdown(!showExportDropdown)}
                    className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 whitespace-nowrap"
                  >
                    Export ▼
                  </button>
                  
                  {showExportDropdown && (
                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-xl border border-gray-200 z-50">
                      <div className="py-1">
                        <button
                          onClick={exportToExcel}
                          className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        >
                          📊 Export to Excel
                        </button>
                        <button
                          onClick={exportToCSV}
                          className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        >
                          📄 Export to CSV
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Desktop layout - everything on one line */}
            <div className="hidden md:flex md:items-center md:justify-between gap-4">
              <div className="flex items-center gap-3">
                {/* Column Selector */}
                <div className="relative" ref={columnSelectorRef}>
                  <button
                    onClick={() => setShowColumnSelector(!showColumnSelector)}
                    className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 whitespace-nowrap"
                  >
                    Columns
                  </button>
              
              {/* Mobile Column Dropdown (only show on smaller screens when desktop side panel is not visible) */}
              {showColumnSelector && (
                <div 
                  ref={mobileColumnDropdownRef}
                  className="lg:hidden absolute left-0 mt-2 w-80 bg-white rounded-lg shadow-xl border border-gray-200 z-50 max-h-96 overflow-y-auto"
                >
                  <div className="p-4 border-b border-gray-200">
                    <div className="flex gap-2 mb-3">
                      <button
                        onClick={showAllColumns}
                        className="px-3 py-1.5 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
                      >
                        Show All
                      </button>
                      <button
                        onClick={hideAllColumns}
                        className="px-3 py-1.5 text-xs bg-gray-500 text-white rounded hover:bg-gray-600"
                      >
                        Hide All
                      </button>
                    </div>
                  </div>
                  <div className="max-h-64 overflow-y-auto p-4 space-y-2">
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
                        className="w-full p-2 text-left hover:bg-gray-50 flex items-center justify-between"
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
                        <div className="px-2 pb-2 space-y-1" onClick={(e) => e.stopPropagation()}>
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
                            <label key={id} className="flex items-center space-x-2 text-sm text-gray-600 ml-4">
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
                            if (e.target instanceof HTMLElement && e.target.closest('.three-state-checkbox')) {
                              return;
                            }
                            handleGroupClick('public-data');
                          }}
                          className="w-full p-2 text-left hover:bg-gray-50 flex items-center justify-between"
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
                          <div className="px-2 pb-2 space-y-1" onClick={(e) => e.stopPropagation()}>
                            <label className="flex items-center space-x-2 text-sm text-gray-600 ml-4">
                              <input
                                type="checkbox"
                                checked={selectedColumns.has('public_timestamp')}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  toggleColumnVisibility('public_timestamp', e.target.checked);
                                }}
                                className="rounded border-gray-300"
                              />
                              <span className="font-medium">📅 Timestamp</span>
                            </label>
                            {Object.keys(columnStructure.public_data).map(key => {
                              const colId = `public_data.${key}`;
                              return (
                                <label key={colId} className="flex items-center space-x-2 text-sm text-gray-600 ml-4">
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
                            if (e.target instanceof HTMLElement && e.target.closest('.three-state-checkbox')) {
                              return;
                            }
                            handleGroupClick('status-data');
                          }}
                          className="w-full p-2 text-left hover:bg-gray-50 flex items-center justify-between"
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
                          <div className="px-2 pb-2 space-y-1" onClick={(e) => e.stopPropagation()}>
                            <label className="flex items-center space-x-2 text-sm text-gray-600 ml-4">
                              <input
                                type="checkbox"
                                checked={selectedColumns.has('status_timestamp')}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  toggleColumnVisibility('status_timestamp', e.target.checked);
                                }}
                                className="rounded border-gray-300"
                              />
                              <span className="font-medium">📅 Timestamp</span>
                            </label>
                            {Object.keys(columnStructure.status_data).map(key => {
                              const colId = `status_data.${key}`;
                              return (
                                <label key={colId} className="flex items-center space-x-2 text-sm text-gray-600 ml-4">
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
                    <div>
                      <button
                        onClick={(e) => {
                          if (e.target instanceof HTMLElement && e.target.closest('.three-state-checkbox')) {
                            return;
                          }
                          handleGroupClick('measurements');
                        }}
                        className="w-full p-2 text-left hover:bg-gray-50 flex items-center justify-between"
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
                          <span className="font-medium text-gray-700">📋 Measurements ({Object.keys(columnStructure.measurements_data).length})</span>
                        </div>
                      </button>
                      {expandedGroup === 'measurements' && (
                        <div className="px-2 pb-2 space-y-1" onClick={(e) => e.stopPropagation()}>
                          <label className="flex items-center space-x-2 text-sm text-gray-600 ml-4">
                            <input
                              type="checkbox"
                              checked={selectedColumns.has('measurements_timestamp')}
                              onChange={(e) => {
                                e.stopPropagation();
                                toggleColumnVisibility('measurements_timestamp', e.target.checked);
                              }}
                              className="rounded border-gray-300"
                            />
                            <span className="font-medium">📅 Timestamp</span>
                          </label>
                          {Object.keys(columnStructure.measurements_data).map(key => {
                            const colId = `measurements_data.${key}`;
                            return (
                              <label key={colId} className="flex items-center space-x-2 text-sm text-gray-600 ml-4">
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
                  </div>
                </div>
              )}
            </div>

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
                  onClick={resetToDefault}
                  className="text-sm text-gray-500 hover:text-gray-700 underline whitespace-nowrap"
                >
                  Reset
                </button>

                <div className="text-sm text-gray-600 whitespace-nowrap">
                  {isFiltered ? (
                    <>Showing {filteredCount} of {rowCount} stations</>
                  ) : (
                    <>{rowCount} stations</>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3">
                {/* Export Button */}
                <div className="relative" ref={exportDropdownRef}>
                  <button
                    onClick={() => setShowExportDropdown(!showExportDropdown)}
                    className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 whitespace-nowrap"
                  >
                    Export ▼
                  </button>
                  
                  {showExportDropdown && (
                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-xl border border-gray-200 z-50">
                      <div className="py-1">
                        <button
                          onClick={exportToExcel}
                          className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        >
                          📊 Export to Excel
                        </button>
                        <button
                          onClick={exportToCSV}
                          className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        >
                          📄 Export to CSV
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Table and Column Selector Container */}
      <div className="flex">
        {/* Desktop Side Panel */}
        {showColumnSelector && (
          <div
            ref={desktopColumnPanelRef}
            className="hidden lg:flex w-132 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden flex-col mr-4"
            style={{ height: 'calc(100vh - 320px)' }}
          >
            <div className="p-4 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
              <h3 className="font-medium text-gray-900">Column Visibility</h3>
              <button
                onClick={() => setShowColumnSelector(false)}
                className="text-gray-400 hover:text-gray-600 text-lg leading-none"
              >
                ×
              </button>
            </div>
          
          <div className="p-4 border-b border-gray-200 bg-gray-50 flex-shrink-0">
            <div className="flex gap-2">
              <button
                onClick={showAllColumns}
                className="px-3 py-1.5 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Show All
              </button>
              <button
                onClick={hideAllColumns}
                className="px-3 py-1.5 text-xs bg-gray-500 text-white rounded hover:bg-gray-600"
              >
                Hide All
              </button>
            </div>
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
                  {/* Note: ID, Name, and Type are pinned left on desktop but not pinned on mobile */}
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
                    {/* Timestamp column first */}
                    <label className="flex items-center space-x-2 text-sm text-gray-600 ml-6">
                      <input
                        type="checkbox"
                        checked={selectedColumns.has('public_timestamp')}
                        onChange={(e) => {
                          e.stopPropagation();
                          toggleColumnVisibility('public_timestamp', e.target.checked);
                        }}
                        className="rounded border-gray-300"
                      />
                      <span className="font-medium">📅 Timestamp</span>
                    </label>
                    {/* Other public data columns */}
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
                    {/* Timestamp column first */}
                    <label className="flex items-center space-x-2 text-sm text-gray-600 ml-6">
                      <input
                        type="checkbox"
                        checked={selectedColumns.has('status_timestamp')}
                        onChange={(e) => {
                          e.stopPropagation();
                          toggleColumnVisibility('status_timestamp', e.target.checked);
                        }}
                        className="rounded border-gray-300"
                      />
                      <span className="font-medium">📅 Timestamp</span>
                    </label>
                    {/* Other status data columns */}
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
                  <span className="font-medium text-gray-700">📋 Measurements ({Object.keys(columnStructure.measurements_data).length})</span>
                </div>
              </button>
              {expandedGroup === 'measurements' && (
                <div className="px-4 pb-4 space-y-2" onClick={(e) => e.stopPropagation()}>
                  {/* Timestamp column first */}
                  <label className="flex items-center space-x-2 text-sm text-gray-600 ml-6">
                    <input
                      type="checkbox"
                      checked={selectedColumns.has('measurements_timestamp')}
                      onChange={(e) => {
                        e.stopPropagation();
                        toggleColumnVisibility('measurements_timestamp', e.target.checked);
                      }}
                      className="rounded border-gray-300"
                    />
                    <span className="font-medium">📅 Timestamp</span>
                  </label>
                  {/* Other measurements columns */}
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
          </div>
        </div>
      )}

        {/* Table */}
        <div 
          className="ag-theme-alpine" 
          style={{ 
            height: 'calc(100vh - 320px)',
            width: '100%'
          }}
        >
          <AgGridReact
            columnDefs={columnDefs}
            rowData={filteredData}
            onGridReady={onGridReady}
            onFilterChanged={onFilterChanged}
            onModelUpdated={onModelUpdated}
            animateRows={false}
            onRowClicked={(event) => {
              const id = event.data.id;
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
    </div>
  );
}
