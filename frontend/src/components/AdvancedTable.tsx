'use client'

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { AgGridReact } from 'ag-grid-react';
import api from '@/utils/api';
import {
  ModuleRegistry,
  AllCommunityModule,
  ColDef,
  GridReadyEvent,
  GridApi,
  ICellRendererParams
} from 'ag-grid-community';
import { AdvancedStationData } from '@/types/station';
import { useRouter, useSearchParams } from 'next/navigation';
import * as ExcelJS from 'exceljs';
import ThreeStateCheckbox from './ThreeStateCheckbox';
import TimelineCell from './TimelineCell';
import { useAdvancedTablePersistence } from '@/hooks/useAdvancedTablePersistence';

ModuleRegistry.registerModules([AllCommunityModule]);

interface AdvancedTableProps {
  readonly className?: string;
  // readonly height?: string;
  readonly onRowClick?: (stationId: number) => void;
  readonly defaultSelectedColumns?: readonly string[];
  readonly showControls?: boolean;
}

export default function AdvancedTable({
  className = "",
  // height = "",
  onRowClick,
  defaultSelectedColumns = [
    'label', 'county', 'online_24h_avg', 'data_health_24h_avg', 'sms_number'
  ],
  showControls = true
}: AdvancedTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
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

  // Datetime compare controls
  const [compareDateTime, setCompareDateTime] = useState<string>('');
  const [includeDateTimeCompare, setIncludeDateTimeCompare] = useState<boolean>(false);
  const [dateTimeData, setDateTimeData] = useState<AdvancedStationData[]>([]);
  const [historySelectedColumns, setHistorySelectedColumns] = useState<Set<string>>(new Set());

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
    saveComponentState,
    clearState
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
        console.log("Station data:", res.data.stations)
        if (res.status === 200) {
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

  // Fetch advanced table snapshot at a specific datetime
  useEffect(() => {
    let cancelled = false;
    const fetchAtDatetime = async () => {
      if (!compareDateTime) { setDateTimeData([]); return; }
      try {
        console.log("Fetching advanced table for datetime:", compareDateTime);
  const res = await api.get<{ stations: AdvancedStationData[] }>(`/stations/advanced-table-datetime?datetime=${encodeURIComponent(compareDateTime)}`);
        if (!cancelled && res.status === 200) {
          setDateTimeData(res.data.stations ?? []);
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Failed to fetch advanced table at datetime', err);
          setDateTimeData([]);
        }
      }
    };
    fetchAtDatetime();
    return () => { cancelled = true; };
  }, [compareDateTime]);

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
        station.ip_modem_http,
        station.ip_modem_https,
        station.ip_datalogger_pakbus,
        station.ip_datalogger_http,
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
    const gridFilterModel = gridApi.getFilterModel() || {};
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
      const tab = searchParams?.get('tab') || 'list'
      router.push(`/station/${stationId}?tab=${encodeURIComponent(tab)}`);
    }
  }, [onRowClick, router, searchParams]);

  // Show columns management
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

    const publicKeys = Object.keys(columnStructure?.public_data ?? {});
    const statusKeys = Object.keys(columnStructure?.status_data ?? {});
    const measurementKeys = Object.keys(columnStructure?.measurements_data ?? {});

    let columnsToToggle: string[] = [];
    
    switch (groupName) {
      case 'station':
        // Exclude pinned columns (label_id, label_name, label_type) - they're pinned on desktop but configurable on mobile
        columnsToToggle = [
          'label', 'latitude', 'longitude', 'altitude', 'county', 
          'ip_modem_http', 'ip_modem_https', 'ip_datalogger_pakbus', 'ip_datalogger_http', 'sms_number', 'online_24h_avg', 'online_7d_avg', 'online_24h_graph', 'online_7d_graph', 'data_health_24h_graph', 'data_health_7d_graph', 
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
      for (const colId of columnsToToggle) {
        if (isVisible) {
          newSet.add(colId);
        } else {
          newSet.delete(colId);
        }
      }
      return newSet;
    });
  }, [stationData, columnStructure]);

  // History column visibility management
  const toggleHistoryColumnVisibility = useCallback((columnId: string, isVisible: boolean) => {
    setHistorySelectedColumns(prev => {
      const newSet = new Set(prev);
      if (isVisible) {
        newSet.add(columnId);
      } else {
        newSet.delete(columnId);
      }
      return newSet;
    });
  }, []);

  const toggleHistoryColumnGroup = useCallback((groupName: string, isVisible: boolean) => {
    if (!includeDateTimeCompare || !compareDateTime || dateTimeData.length === 0) return;

    const publicKeys = Object.keys(columnStructure?.public_data ?? {});
    const statusKeys = Object.keys(columnStructure?.status_data ?? {});
    const measurementKeys = Object.keys(columnStructure?.measurements_data ?? {});

    let columnsToToggle: string[] = [];
    switch (groupName) {
      case 'history-public-data':
        columnsToToggle = ['history_public_timestamp', ...publicKeys.map(key => `history_public_data.${key}`)];
        break;
      case 'history-status-data':
        columnsToToggle = ['history_status_timestamp', ...statusKeys.map(key => `history_status_data.${key}`)];
        break;
      case 'history-measurements':
        columnsToToggle = ['history_measurements_timestamp', ...measurementKeys.map(key => `history_measurements_data.${key}`)];
        break;
    }

    setHistorySelectedColumns(prev => {
      const newSet = new Set(prev);
      for (const colId of columnsToToggle) {
        if (isVisible) newSet.add(colId); else newSet.delete(colId);
      }
      return newSet;
    });
  }, [includeDateTimeCompare, compareDateTime, dateTimeData.length, columnStructure]);

  const getHistoryGroupState = useCallback((groupName: string): 'all' | 'some' | 'none' => {
    if (!includeDateTimeCompare || !compareDateTime || dateTimeData.length === 0) return 'none';

    const publicKeys = Object.keys(columnStructure.public_data);
    const statusKeys = Object.keys(columnStructure.status_data);
    const measurementKeys = Object.keys(columnStructure.measurements_data);

    let columnsInGroup: string[] = [];
    switch (groupName) {
      case 'history-public-data':
        columnsInGroup = ['history_public_timestamp', ...publicKeys.map(key => `history_public_data.${key}`)];
        break;
      case 'history-status-data':
        columnsInGroup = ['history_status_timestamp', ...statusKeys.map(key => `history_status_data.${key}`)];
        break;
      case 'history-measurements':
        columnsInGroup = ['history_measurements_timestamp', ...measurementKeys.map(key => `history_measurements_data.${key}`)];
        break;
    }

    if (columnsInGroup.length === 0) return 'none';
    const selectedCount = columnsInGroup.filter(colId => historySelectedColumns.has(colId)).length;
    if (selectedCount === columnsInGroup.length) return 'all';
    if (selectedCount > 0) return 'some';
    return 'none';
  }, [includeDateTimeCompare, compareDateTime, dateTimeData.length, columnStructure, historySelectedColumns]);

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
          'label', 'latitude', 'longitude', 'altitude', 'county', 
          'ip_modem_http', 'ip_modem_https', 'ip_datalogger_pakbus', 'ip_datalogger_http', 'sms_number', 'online_24h_avg', 'online_7d_avg', 'online_24h_graph', 'online_7d_graph', 'data_health_24h_graph', 'data_health_7d_graph', 
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
      'label', 'latitude', 'longitude', 'altitude', 'county', 'ip_modem_http', 'ip_modem_https', 'ip_datalogger_pakbus', 'ip_datalogger_http', 'sms_number',
  'online_24h_avg', 'online_7d_avg', 'online_24h_graph', 'online_7d_graph', 'data_health_24h_graph', 'data_health_7d_graph', 'online_last_seen',
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
      for (const row of rowData) {
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
      }

      // Style headers
      const headerRow = worksheet.getRow(1);
      headerRow.font = { bold: true };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' }
      };

      // Auto-fit columns
      for (const [index, column] of worksheet.columns.entries()) {
        const header = headers[index];
        const maxLength = Math.max(
          header?.length || 0,
          15 // minimum width
        );
        column.width = Math.min(maxLength * 1.2, 50); // max width of 50
      }

      // Generate and download file
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
      });
      
      const url = globalThis.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `station_data_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      globalThis.URL.revokeObjectURL(url);
      
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

  // Helper function to check if a value is numeric across stations
  const isColumnNumeric = useCallback((dataKey: string, nestedKey?: string): boolean => {
    for (const station of stationData) {
      const sampleValue = nestedKey 
        ? (station as unknown as Record<string, Record<string, unknown>>)[dataKey]?.[nestedKey]
        : (station as unknown as Record<string, unknown>)[dataKey];
      
      if (sampleValue !== undefined && sampleValue !== null && sampleValue !== '' && !Array.isArray(sampleValue) && sampleValue !== 'NaN') {
        const numValue = Number(sampleValue);
        if (!Number.isNaN(numValue)) {
          return true;
        }
      }
    }
    return false;
  }, [stationData]);

  // Helper function to create numeric comparator
  const createNumericComparator = useCallback(() => {
    return (valueA: unknown, valueB: unknown) => {
      const numA = (valueA === undefined || valueA === null || valueA === '' || valueA === 'NaN' || Number.isNaN(Number(valueA))) ? -Infinity : Number(valueA);
      const numB = (valueB === undefined || valueB === null || valueB === '' || valueB === 'NaN' || Number.isNaN(Number(valueB))) ? -Infinity : Number(valueB);
      return numA - numB;
    };
  }, []);

  // Helper function to create date filter params
  const createDateFilterParams = useCallback(() => ({
    buttons: ['reset', 'apply'] as const,
    comparator: (filterDate: Date, cellValue: string) => {
      const cellDate = new Date(cellValue);
      return cellDate.getTime() - filterDate.getTime();
    }
  }), []);

  // Helper function to add basic pinned columns
  const addBasicColumns = useCallback((columns: ColDef[], isPinned: boolean) => {
    columns.push({
      headerName: 'ID',
      field: 'label_id',
      pinned: isPinned ? 'left' : undefined,
      minWidth: 80,
      maxWidth: 100,
      cellStyle: { fontWeight: '600' },
      // Ensure numeric behavior for sorting/filtering regardless of underlying data type
      valueGetter: (params) => {
        const v = params.data?.label_id;
        const n = Number(v);
        return Number.isFinite(n) ? n : null;
      },
      comparator: createNumericComparator(),
      filter: 'agNumberColumnFilter',
      filterParams: { buttons: ['reset', 'apply'] }
    });

    columns.push({
      headerName: 'Name',
      field: 'label_name',
      pinned: isPinned ? 'left' : undefined,
      minWidth: 200,
      flex: 1,
      cellStyle: { fontWeight: '600', fontSize: '16px' },
      cellRenderer: (params: ICellRendererParams) => {
        const id = params.data?.id;
        return (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleRowClick(Number(id));
            }}
            className="text-lg underline text-gray-900 bg-transparent border-none p-0 cursor-pointer"
          >
            {params.value}
          </button>
        );
      },
      filter: 'agTextColumnFilter',
      filterParams: { buttons: ['reset', 'apply'], debounceMs: 300 }
    });

    columns.push({
      headerName: 'Type',
      field: 'label_type',
      pinned: isPinned ? 'left' : undefined,
      minWidth: 100,
      maxWidth: 120,
      filter: 'agTextColumnFilter',
      filterParams: { buttons: ['reset', 'apply'] }
    });
  }, [handleRowClick, createNumericComparator]);

  // Helper function to add station info columns
  const addStationInfoColumns = useCallback((columns: ColDef[], selected: Set<string>) => {
    if (selected.has('label')) {
      columns.push({
        headerName: 'Label',
        field: 'label',
        minWidth: 150,
        filter: 'agTextColumnFilter',
        filterParams: { buttons: ['reset', 'apply'], debounceMs: 300 }
      });
    }

    if (selected.has('latitude')) {
      columns.push({
        headerName: 'Latitude',
        field: 'latitude',
        minWidth: 120,
        valueFormatter: params => params.value ? params.value.toFixed(6) : '',
        filter: 'agNumberColumnFilter',
        filterParams: { buttons: ['reset', 'apply'] }
      });
    }

    if (selected.has('longitude')) {
      columns.push({
        headerName: 'Longitude',
        field: 'longitude',
        minWidth: 120,
        valueFormatter: params => params.value ? params.value.toFixed(6) : '',
        filter: 'agNumberColumnFilter',
        filterParams: { buttons: ['reset', 'apply'] }
      });
    }

    if (selected.has('altitude')) {
      columns.push({
        headerName: 'Altitude',
        field: 'altitude',
        minWidth: 100,
        valueFormatter: params => params.value ? `${params.value}m` : '',
        filter: 'agNumberColumnFilter',
        filterParams: { buttons: ['reset', 'apply'] }
      });
    }

    if (selected.has('county')) {
      columns.push({
        headerName: 'County',
        field: 'county',
        minWidth: 140,
        filter: 'agTextColumnFilter',
        filterParams: { buttons: ['reset', 'apply'], debounceMs: 300 }
      });
    }

    if (selected.has('ip_modem_http')) {
      columns.push({
        headerName: 'IP Modem (HTTP)',
        field: 'ip_modem_http',
        minWidth: 180,
        filter: 'agTextColumnFilter',
        filterParams: { buttons: ['reset', 'apply'] },
        cellRenderer: (params: ICellRendererParams) => {
          const value = params.value as string | undefined
          if (!value) return ''
          const href = `http://${value}`
          return (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 underline"
              onClick={(e) => e.stopPropagation()}
            >
              {value}
            </a>
          )
        }
      });
    }

    if (selected.has('ip_modem_https')) {
      columns.push({
        headerName: 'IP Modem (HTTPS)',
        field: 'ip_modem_https',
        minWidth: 180,
        filter: 'agTextColumnFilter',
        filterParams: { buttons: ['reset', 'apply'] },
        cellRenderer: (params: ICellRendererParams) => {
          const value = params.value as string | undefined
          if (!value) return ''
          const href = `https://${value}`
          return (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 underline"
              onClick={(e) => e.stopPropagation()}
            >
              {value}
            </a>
          )
        }
      });
    }

    if (selected.has('ip_datalogger_pakbus')) {
      columns.push({
        headerName: 'IP Datalogger (PakBus)',
        field: 'ip_datalogger_pakbus',
        minWidth: 200,
        filter: 'agTextColumnFilter',
        filterParams: { buttons: ['reset', 'apply'] },
        cellRenderer: (params: ICellRendererParams) => {
          const value = params.value as string | undefined
          if (!value) return ''
          const href = `http://${value}`
          return (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 underline"
              onClick={(e) => e.stopPropagation()}
            >
              {value}
            </a>
          )
        }
      });
    }

    if (selected.has('ip_datalogger_http')) {
      columns.push({
        headerName: 'IP Datalogger (HTTP)',
        field: 'ip_datalogger_http',
        minWidth: 200,
        filter: 'agTextColumnFilter',
        filterParams: { buttons: ['reset', 'apply'] },
        cellRenderer: (params: ICellRendererParams) => {
          const value = params.value as string | undefined
          if (!value) return ''
          const href = `http://${value}`
          return (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 underline"
              onClick={(e) => e.stopPropagation()}
            >
              {value}
            </a>
          )
        }
      });
    }

    if (selected.has('sms_number')) {
      columns.push({
        headerName: 'SMS Number',
        field: 'sms_number',
        minWidth: 150,
        filter: 'agTextColumnFilter',
        filterParams: { buttons: ['reset', 'apply'] }
      });
    }
  }, []);

  // Helper function to add health/status columns
  const addHealthColumns = useCallback((columns: ColDef[], selected: Set<string>) => {
    if (selected.has('online_24h_avg')) {
      columns.push({
        headerName: 'Online_24h_Avg',
        field: 'avg_fetch_health_24h',
        minWidth: 120,
        maxWidth: 150,
        valueGetter: params => {
          const raw = (params.data as Record<string, unknown>)?.['avg_fetch_health_24h'];
          const num = Number(raw);
          if (raw === null || raw === undefined || raw === '' || Number.isNaN(num)) return null;
          return Math.round(num * 100) / 100;
        },
        valueFormatter: params => {
          if (params.value === null || params.value === undefined) return '';
          const num = Number(params.value);
          if (Number.isNaN(num)) return '';
          return Number.isInteger(num) ? `${num}%` : `${num.toFixed(2)}%`;
        },
        filter: 'agNumberColumnFilter',
        filterParams: { buttons: ['reset', 'apply'] }
      });
    }

    if (selected.has('online_24h_graph')) {
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

    if (selected.has('online_7d_avg')) {
      columns.push({
        headerName: 'Online_7d_Avg',
        field: 'avg_fetch_health_7d',
        minWidth: 120,
        maxWidth: 150,
        valueGetter: params => {
          const raw = (params.data as Record<string, unknown>)?.['avg_fetch_health_7d'];
          const num = Number(raw);
          if (raw === null || raw === undefined || raw === '' || Number.isNaN(num)) return null;
          return Math.round(num * 100) / 100;
        },
        valueFormatter: params => {
          if (params.value === null || params.value === undefined) return '';
          const num = Number(params.value);
          if (Number.isNaN(num)) return '';
          return Number.isInteger(num) ? `${num}%` : `${num.toFixed(2)}%`;
        },
        filter: 'agNumberColumnFilter',
        filterParams: { buttons: ['reset', 'apply'] }
      });
    }

    if (selected.has('online_7d_graph')) {
      columns.push({
        headerName: 'Online_7d_Graph',
        field: 'hourly_status_7d',
        cellRenderer: TimelineCell,
        cellRendererParams: (params: { data?: AdvancedStationData }) => ({
          timestamps: params.data?.hourly_timestamps_7d,
          maxBars: 29,
          BarWidth: 5.2,
        }),
        sortable: false,
        filter: false,
        minWidth: 250
      });
    }

    if (selected.has('online_last_seen')) {
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
        filterParams: createDateFilterParams()
      });
    }

    if (selected.has('data_health_24h_avg')) {
      columns.push({
        headerName: 'Data_Health_24h_Avg',
        field: 'avg_data_health_24h',
        minWidth: 120,
        maxWidth: 180,
        valueGetter: params => {
          const raw = (params.data as Record<string, unknown>)?.['avg_data_health_24h'];
          const num = Number(raw);
          if (raw === null || raw === undefined || raw === '' || Number.isNaN(num)) return null;
          return Math.round(num * 100) / 100;
        },
        valueFormatter: params => {
          if (params.value === null || params.value === undefined) return '';
          const num = Number(params.value);
          if (Number.isNaN(num)) return '';
          return Number.isInteger(num) ? `${num}%` : `${num.toFixed(2)}%`;
        },
        filter: 'agNumberColumnFilter',
        filterParams: { buttons: ['reset', 'apply'] }
      });
    }

    // Data Health 24h Graph independent of Avg selection
    if (selected.has('data_health_24h_graph')) {
      columns.push({
        headerName: 'Data_Health_24h_Graph',
        field: 'hourly_data_status',
        cellRenderer: TimelineCell,
        cellRendererParams: (params: { data?: AdvancedStationData }) => ({
          timestamps: params.data?.hourly_timestamps,
        }),
        sortable: false,
        filter: false,
        minWidth: 250,
      });
    }

    if (selected.has('data_health_7d_avg')) {
      columns.push({
        headerName: 'Data_Health_7d_Avg',
        field: 'avg_data_health_7d',
        minWidth: 130,
        maxWidth: 170,
        valueGetter: params => {
          const raw = (params.data as Record<string, unknown>)?.['avg_data_health_7d'];
          const num = Number(raw);
          if (raw === null || raw === undefined || raw === '' || Number.isNaN(num)) return null;
          return Math.round(num * 100) / 100;
        },
        valueFormatter: params => {
          if (params.value === null || params.value === undefined) return '';
          const num = Number(params.value);
          if (Number.isNaN(num)) return '';
          return Number.isInteger(num) ? `${num}%` : `${num.toFixed(2)}%`;
        },
        filter: 'agNumberColumnFilter',
        filterParams: { buttons: ['reset', 'apply'] }
      });
    }

    // Data Health 7d Graph independent of Avg selection
    if (selected.has('data_health_7d_graph')) {
      columns.push({
        headerName: 'Data_Health_7d_Graph',
        field: 'hourly_data_status_7d',
        cellRenderer: TimelineCell,
        cellRendererParams: (params: { data?: AdvancedStationData }) => ({
          timestamps: params.data?.hourly_timestamps_7d,
          maxBars: 29,
          BarWidth: 5.2,
        }),
        sortable: false,
        filter: false,
        minWidth: 250,
      });
    }
  }, [createDateFilterParams]);

  // Helper function to add dynamic data columns
  const addDynamicDataColumns = useCallback((
    columns: ColDef[], 
    selected: Set<string>,
    dataKeys: Record<string, string>,
    prefix: string,
    dataField: string
  ) => {
    // The API exposes timestamps at root level as `public_timestamp`,
    // `status_timestamp`, and `measurements_timestamp`. `dataField` is
    // one of 'public_data' | 'status_data' | 'measurements_data', so
    // map it to the correct root-level timestamp key here.
    let timestampKey = '';
    if (dataField === 'public_data') timestampKey = 'public_timestamp';
    else if (dataField === 'status_data') timestampKey = 'status_timestamp';
    else if (dataField === 'measurements_data') timestampKey = 'measurements_timestamp';

    if (timestampKey && selected.has(timestampKey)) {
      columns.push({
        headerName: `${prefix}: Timestamp`,
        field: timestampKey,
        minWidth: 160,
        valueFormatter: params => {
          if (!params.value) return '';
          try {
            return new Date(params.value).toLocaleString();
          } catch {
            return params.value;
          }
        },
        filter: 'agDateColumnFilter',
        filterParams: createDateFilterParams()
      });
    }

    for (const key of Object.keys(dataKeys)) {
      const colId = `${dataField}.${key}`;
      if (selected.has(colId)) {
        const isNumeric = isColumnNumeric(dataField, key);
        
        columns.push({
          headerName: `${prefix}: ${key}`,
          field: colId,
          minWidth: 120,
          valueGetter: params => {
            const raw = (params.data as Record<string, Record<string, unknown>>)?.[dataField]?.[key];
            if (!isNumeric) return (raw ?? '') as unknown;
            const num = Number(raw);
            if (raw === null || raw === undefined || raw === '' || Number.isNaN(num)) return null;
            return Math.round(num * 100) / 100;
          },
          valueFormatter: isNumeric ? (params => {
            if (params.value === null || params.value === undefined) return '';
            const num = Number(params.value);
            if (Number.isNaN(num)) return '';
            return Number.isInteger(num) ? `${num}` : num.toFixed(2);
          }) : undefined,
          comparator: isNumeric ? createNumericComparator() : undefined,
          filter: isNumeric ? 'agNumberColumnFilter' : 'agTextColumnFilter',
          filterParams: { buttons: ['reset', 'apply'] }
        });
      }
    }
  }, [isColumnNumeric, createNumericComparator, createDateFilterParams]);

  // Generate column definitions
  const columnDefs = useMemo((): ColDef[] => {
    // Only return early if there's no station data or none of the dynamic groups have any keys
    const hasPublic = columnStructure.public_data && Object.keys(columnStructure.public_data).length > 0;
    const hasStatus = columnStructure.status_data && Object.keys(columnStructure.status_data).length > 0;
    const hasMeasurements = columnStructure.measurements_data && Object.keys(columnStructure.measurements_data).length > 0;
    const hasAnyStructure = hasPublic || hasStatus || hasMeasurements;
    if (stationData.length === 0 || !hasAnyStructure) return [];

    const columns: ColDef[] = [];

    // Add basic pinned columns
    addBasicColumns(columns, !isMobile);

    // Add station info columns
    addStationInfoColumns(columns, selectedColumns);

    // Add health/status columns
    addHealthColumns(columns, selectedColumns);

    // Add dynamic data columns
    addDynamicDataColumns(columns, selectedColumns, columnStructure.public_data, 'Public', 'public_data');
    addDynamicDataColumns(columns, selectedColumns, columnStructure.status_data, 'Status', 'status_data');
    addDynamicDataColumns(columns, selectedColumns, columnStructure.measurements_data, 'Measurements', 'measurements_data');

    // If history is enabled, add separate history columns based on selections
    if (includeDateTimeCompare && compareDateTime && dateTimeData.length > 0) {
      const dtById = new Map<number, AdvancedStationData>();
      for (const row of dateTimeData) dtById.set(row.id, row);

      if (historySelectedColumns.has('history_public_timestamp')) {
        columns.push({
          headerName: `Public: Timestamp (${compareDateTime})`,
          field: 'history_public_timestamp',
          minWidth: 160,
          valueGetter: params => {
            const dtRow = dtById.get((params.data as AdvancedStationData).id);
            return (dtRow as unknown as Record<string, unknown>)?.['public_timestamp'] || '';
          },
          filter: 'agDateColumnFilter',
          filterParams: createDateFilterParams(),
        });
      }
      if (historySelectedColumns.has('history_status_timestamp')) {
        columns.push({
          headerName: `Status: Timestamp (${compareDateTime})`,
          field: 'history_status_timestamp',
          minWidth: 160,
          valueGetter: params => {
            const dtRow = dtById.get((params.data as AdvancedStationData).id);
            return (dtRow as unknown as Record<string, unknown>)?.['status_timestamp'] || '';
          },
          filter: 'agDateColumnFilter',
          filterParams: createDateFilterParams(),
        });
      }
      if (historySelectedColumns.has('history_measurements_timestamp')) {
        columns.push({
          headerName: `Measurements: Timestamp (${compareDateTime})`,
          field: 'history_measurements_timestamp',
          minWidth: 160,
          valueGetter: params => {
            const dtRow = dtById.get((params.data as AdvancedStationData).id);
            return (dtRow as unknown as Record<string, unknown>)?.['measurements_timestamp'] || '';
          },
          filter: 'agDateColumnFilter',
          filterParams: createDateFilterParams(),
        });
      }

      for (const key of Object.keys(columnStructure.public_data)) {
        const colId = `history_public_data.${key}`;
        if (historySelectedColumns.has(colId)) {
          const isNumeric = isColumnNumeric('public_data', key);
          columns.push({
            headerName: `Public: ${key} (${compareDateTime})`,
            field: colId,
            minWidth: 120,
            valueGetter: params => {
              const dtRow = dtById.get((params.data as AdvancedStationData).id);
              const raw = (dtRow as unknown as Record<string, Record<string, unknown>>)?.['public_data']?.[key];
              if (!isNumeric) return (raw ?? '') as unknown;
              const num = Number(raw);
              if (raw === null || raw === undefined || raw === '' || Number.isNaN(num)) return null;
              return Math.round(num * 100) / 100;
            },
            valueFormatter: isNumeric ? (params => {
              if (params.value === null || params.value === undefined) return '';
              const num = Number(params.value);
              if (Number.isNaN(num)) return '';
              return Number.isInteger(num) ? `${num}` : num.toFixed(2);
            }) : undefined,
            comparator: isNumeric ? createNumericComparator() : undefined,
            filter: isNumeric ? 'agNumberColumnFilter' : 'agTextColumnFilter',
            filterParams: { buttons: ['reset', 'apply'] },
          });
        }
      }
      for (const key of Object.keys(columnStructure.status_data)) {
        const colId = `history_status_data.${key}`;
        if (historySelectedColumns.has(colId)) {
          const isNumeric = isColumnNumeric('status_data', key);
          columns.push({
            headerName: `Status: ${key} (${compareDateTime})`,
            field: colId,
            minWidth: 120,
            valueGetter: params => {
              const dtRow = dtById.get((params.data as AdvancedStationData).id);
              const raw = (dtRow as unknown as Record<string, Record<string, unknown>>)?.['status_data']?.[key];
              if (!isNumeric) return (raw ?? '') as unknown;
              const num = Number(raw);
              if (raw === null || raw === undefined || raw === '' || Number.isNaN(num)) return null;
              return Math.round(num * 100) / 100;
            },
            valueFormatter: isNumeric ? (params => {
              if (params.value === null || params.value === undefined) return '';
              const num = Number(params.value);
              if (Number.isNaN(num)) return '';
              return Number.isInteger(num) ? `${num}` : num.toFixed(2);
            }) : undefined,
            comparator: isNumeric ? createNumericComparator() : undefined,
            filter: isNumeric ? 'agNumberColumnFilter' : 'agTextColumnFilter',
            filterParams: { buttons: ['reset', 'apply'] },
          });
        }
      }
      for (const key of Object.keys(columnStructure.measurements_data)) {
        const colId = `history_measurements_data.${key}`;
        if (historySelectedColumns.has(colId)) {
          const isNumeric = isColumnNumeric('measurements_data', key);
          columns.push({
            headerName: `Measurements: ${key} (${compareDateTime})`,
            field: colId,
            minWidth: 120,
            valueGetter: params => {
              const dtRow = dtById.get((params.data as AdvancedStationData).id);
              const raw = (dtRow as unknown as Record<string, Record<string, unknown>>)?.['measurements_data']?.[key];
              if (!isNumeric) return (raw ?? '') as unknown;
              const num = Number(raw);
              if (raw === null || raw === undefined || raw === '' || Number.isNaN(num)) return null;
              return Math.round(num * 100) / 100;
            },
            valueFormatter: isNumeric ? (params => {
              if (params.value === null || params.value === undefined) return '';
              const num = Number(params.value);
              if (Number.isNaN(num)) return '';
              return num.toFixed(2);
            }) : undefined,
            comparator: isNumeric ? createNumericComparator() : undefined,
            filter: isNumeric ? 'agNumberColumnFilter' : 'agTextColumnFilter',
            filterParams: { buttons: ['reset', 'apply'] },
          });
        }
      }
    }

    return columns;
  }, [selectedColumns, historySelectedColumns, columnStructure, stationData, isMobile, addBasicColumns, addStationInfoColumns, addHealthColumns, addDynamicDataColumns, includeDateTimeCompare, compareDateTime, dateTimeData, isColumnNumeric, createNumericComparator, createDateFilterParams]);

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
            onClick={() => globalThis.location.reload()}
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
          <div className="w-full bg-white rounded-lg border border-gray-200 shadow-sm mx-auto p-4">
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
                        <div className="px-2 pb-2 space-y-1">
                          {[
                            { id: 'label', label: 'Label' },
                            { id: 'latitude', label: 'Latitude' },
                            { id: 'longitude', label: 'Longitude' },
                            { id: 'altitude', label: 'Altitude' },
                            { id: 'county', label: 'County' },
                            { id: 'ip_modem_http', label: 'IP Modem (HTTP)' },
                            { id: 'ip_modem_https', label: 'IP Modem (HTTPS)' },
                            { id: 'ip_datalogger_pakbus', label: 'IP Datalogger (PakBus)' },
                            { id: 'ip_datalogger_http', label: 'IP Datalogger (HTTP)' },
                            { id: 'sms_number', label: 'SMS Number' },
                            { id: 'online_24h_avg', label: 'Online 24h Avg' },
                            { id: 'online_24h_graph', label: 'Online 24h Graph' },
                            { id: 'online_7d_avg', label: 'Online 7d Avg' },
                            { id: 'online_7d_graph', label: 'Online 7d Graph' },
                            { id: 'online_last_seen', label: 'Online Last Seen' },
                            { id: 'data_health_24h_avg', label: 'Data Health 24h Avg' },
                            { id: 'data_health_24h_graph', label: 'Data Health 24h Graph' },
                            { id: 'data_health_7d_avg', label: 'Data Health 7d Avg' },
                            { id: 'data_health_7d_graph', label: 'Data Health 7d Graph' },
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
                          <div className="px-2 pb-2 space-y-1">
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
                          <div className="px-2 pb-2 space-y-1">
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
                        <div className="px-2 pb-2 space-y-1">
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
                className="w-full pl-10 pr-4 py-2 border border-gray-300 text-gray-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                  <button
                    onClick={() => {
                      try {
                        clearState();
                      } catch (err) {
                        console.error('Error clearing persisted state', err);
                      }
                      // Reload to ensure grid and selectedColumns are re-initialized
                      setTimeout(() => globalThis.location.reload(), 50);
                    }}
                    className="text-sm text-red-500 hover:text-red-700 underline whitespace-nowrap ml-3"
                  >
                    Clear saved layout
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
                        <div className="px-2 pb-2 space-y-1">
                          {[
                            { id: 'label', label: 'Label' },
                            { id: 'latitude', label: 'Latitude' },
                            { id: 'longitude', label: 'Longitude' },
                            { id: 'altitude', label: 'Altitude' },
                            { id: 'county', label: 'County' },
                            { id: 'ip_modem_http', label: 'IP Modem (HTTP)' },
                            { id: 'ip_modem_https', label: 'IP Modem (HTTPS)' },
                            { id: 'ip_datalogger_pakbus', label: 'IP Datalogger (PakBus)' },
                            { id: 'ip_datalogger_http', label: 'IP Datalogger (HTTP)' },
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
                          <div className="px-2 pb-2 space-y-1">
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
                          <div className="px-2 pb-2 space-y-1">
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
                    {/* History Groups (mobile) */}
                    {includeDateTimeCompare && compareDateTime && dateTimeData.length > 0 && (
                      <>
                        {/* History Public Data */}
                        {Object.keys(columnStructure.public_data).length > 0 && (
                          <div className="border-b border-gray-200">
                            <button
                              onClick={(e) => {
                                if (e.target instanceof HTMLElement && e.target.closest('.three-state-checkbox')) {
                                  return;
                                }
                                handleGroupClick('history-public-data');
                              }}
                              className="w-full p-2 text-left hover:bg-gray-50 flex items-center justify-between"
                            >
                              <div className="flex items-center space-x-2">
                                <span className="text-gray-400">
                                  {expandedGroup === 'history-public-data' ? '▼' : '▶'}
                                </span>
                                <div className="three-state-checkbox" onClick={(e) => e.stopPropagation()}>
                                  <ThreeStateCheckbox
                                    state={getHistoryGroupState('history-public-data')}
                                    onChange={(checked) => {
                                      toggleHistoryColumnGroup('history-public-data', checked);
                                    }}
                                  />
                                </div>
                                <span className="font-medium text-gray-700">🌐 Public Data ({compareDateTime})</span>
                              </div>
                            </button>
                            {expandedGroup === 'history-public-data' && (
                              <div className="px-2 pb-2 space-y-1">
                                <label className="flex items-center space-x-2 text-sm text-gray-600 ml-4">
                                  <input
                                    type="checkbox"
                                    checked={historySelectedColumns.has('history_public_timestamp')}
                                    onChange={(e) => {
                                      e.stopPropagation();
                                      toggleHistoryColumnVisibility('history_public_timestamp', e.target.checked);
                                    }}
                                    className="rounded border-gray-300"
                                  />
                                  <span className="font-medium">📅 Timestamp</span>
                                </label>
                                {Object.keys(columnStructure.public_data).map(key => {
                                  const colId = `history_public_data.${key}`;
                                  return (
                                    <label key={colId} className="flex items-center space-x-2 text-sm text-gray-600 ml-4">
                                      <input
                                        type="checkbox"
                                        checked={historySelectedColumns.has(colId)}
                                        onChange={(e) => {
                                          e.stopPropagation();
                                          toggleHistoryColumnVisibility(colId, e.target.checked);
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
                        {/* History Status Data */}
                        {Object.keys(columnStructure.status_data).length > 0 && (
                          <div className="border-b border-gray-200">
                            <button
                              onClick={(e) => {
                                if (e.target instanceof HTMLElement && e.target.closest('.three-state-checkbox')) {
                                  return;
                                }
                                handleGroupClick('history-status-data');
                              }}
                              className="w-full p-2 text-left hover:bg-gray-50 flex items-center justify-between"
                            >
                              <div className="flex items-center space-x-2">
                                <span className="text-gray-400">
                                  {expandedGroup === 'history-status-data' ? '▼' : '▶'}
                                </span>
                                <div className="three-state-checkbox" onClick={(e) => e.stopPropagation()}>
                                  <ThreeStateCheckbox
                                    state={getHistoryGroupState('history-status-data')}
                                    onChange={(checked) => {
                                      toggleHistoryColumnGroup('history-status-data', checked);
                                    }}
                                  />
                                </div>
                                <span className="font-medium text-gray-700">📊 Status Data ({compareDateTime})</span>
                              </div>
                            </button>
                            {expandedGroup === 'history-status-data' && (
                              <div className="px-2 pb-2 space-y-1">
                                <label className="flex items-center space-x-2 text-sm text-gray-600 ml-4">
                                  <input
                                    type="checkbox"
                                    checked={historySelectedColumns.has('history_status_timestamp')}
                                    onChange={(e) => {
                                      e.stopPropagation();
                                      toggleHistoryColumnVisibility('history_status_timestamp', e.target.checked);
                                    }}
                                    className="rounded border-gray-300"
                                  />
                                  <span className="font-medium">📅 Timestamp</span>
                                </label>
                                {Object.keys(columnStructure.status_data).map(key => {
                                  const colId = `history_status_data.${key}`;
                                  return (
                                    <label key={colId} className="flex items-center space-x-2 text-sm text-gray-600 ml-4">
                                      <input
                                        type="checkbox"
                                        checked={historySelectedColumns.has(colId)}
                                        onChange={(e) => {
                                          e.stopPropagation();
                                          toggleHistoryColumnVisibility(colId, e.target.checked);
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
                        {/* History Measurements */}
                        {Object.keys(columnStructure.measurements_data).length > 0 && (
                          <div className="border-b border-gray-200">
                            <button
                              onClick={(e) => {
                                if (e.target instanceof HTMLElement && e.target.closest('.three-state-checkbox')) {
                                  return;
                                }
                                handleGroupClick('history-measurements');
                              }}
                              className="w-full p-2 text-left hover:bg-gray-50 flex items-center justify-between"
                            >
                              <div className="flex items-center space-x-2">
                                <span className="text-gray-400">
                                  {expandedGroup === 'history-measurements' ? '▼' : '▶'}
                                </span>
                                <div className="three-state-checkbox" onClick={(e) => e.stopPropagation()}>
                                  <ThreeStateCheckbox
                                    state={getHistoryGroupState('history-measurements')}
                                    onChange={(checked) => {
                                      toggleHistoryColumnGroup('history-measurements', checked);
                                    }}
                                  />
                                </div>
                                <span className="font-medium text-gray-700">📋 Measurements ({compareDateTime})</span>
                              </div>
                            </button>
                            {expandedGroup === 'history-measurements' && (
                              <div className="px-2 pb-2 space-y-1">
                                <label className="flex items-center space-x-2 text-sm text-gray-600 ml-4">
                                  <input
                                    type="checkbox"
                                    checked={historySelectedColumns.has('history_measurements_timestamp')}
                                    onChange={(e) => {
                                      e.stopPropagation();
                                      toggleHistoryColumnVisibility('history_measurements_timestamp', e.target.checked);
                                    }}
                                    className="rounded border-gray-300"
                                  />
                                  <span className="font-medium">📅 Timestamp</span>
                                </label>
                                {Object.keys(columnStructure.measurements_data).map(key => {
                                  const colId = `history_measurements_data.${key}`;
                                  return (
                                    <label key={colId} className="flex items-center space-x-2 text-sm text-gray-600 ml-4">
                                      <input
                                        type="checkbox"
                                        checked={historySelectedColumns.has(colId)}
                                        onChange={(e) => {
                                          e.stopPropagation();
                                          toggleHistoryColumnVisibility(colId, e.target.checked);
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
                      </>
                    )}
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
                        <div className="px-2 pb-2 space-y-1">
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
              <h3 className="font-medium text-gray-900">Show Columns</h3>
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
          <div className="p-4 border-b border-gray-200 bg-gray-100 flex-shrink-0">
            <div className="flex gap-2 text-gray-500 text-sm">
              Latest data
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
              <div className="px-4 pb-4 space-y-2">
                {/* Note: ID, Name, and Type are pinned left on desktop but not pinned on mobile */}
                  {[
                    { id: 'label', label: 'Label' },
                    { id: 'latitude', label: 'Latitude' },
                    { id: 'longitude', label: 'Longitude' },
                    { id: 'altitude', label: 'Altitude' },
                    { id: 'county', label: 'County' },
                    { id: 'ip_modem_http', label: 'IP Modem (HTTP)' },
                    { id: 'ip_modem_https', label: 'IP Modem (HTTPS)' },
                    { id: 'ip_datalogger_pakbus', label: 'IP Datalogger (PakBus)' },
                    { id: 'ip_datalogger_http', label: 'IP Datalogger (HTTP)' },
                    { id: 'sms_number', label: 'SMS Number' },
                    { id: 'online_24h_avg', label: 'Online 24h Avg' },
                    { id: 'online_24h_graph', label: 'Online 24h Graph' },
                    { id: 'online_7d_avg', label: 'Online 7d Avg' },
                    { id: 'online_7d_graph', label: 'Online 7d Graph' },
                    { id: 'online_last_seen', label: 'Online Last Seen' },
                    { id: 'data_health_24h_avg', label: 'Data Health 24h Avg' },
                    { id: 'data_health_24h_graph', label: 'Data Health 24h Graph' },
                    { id: 'data_health_7d_avg', label: 'Data Health 7d Avg' },
                    { id: 'data_health_7d_graph', label: 'Data Health 7d Graph' },
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
                  <div className="px-4 pb-4 space-y-2">
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
                  <div className="px-4 pb-4 space-y-2">
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
                <div className="px-4 pb-4 space-y-2">
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
            <div className="p-4 border-b border-gray-200 bg-gray-100 flex-shrink-0">
              <div className="flex gap-2">
                {/* Datetime selector and history/newest toggles */}
                <input
                  type="datetime-local"
                  className="px-3 py-1.5 text-xs border border-gray-300 rounded text-gray-500"
                  value={compareDateTime}
                  onChange={(e) => setCompareDateTime(e.target.value)}
                />
                <label className="flex items-center gap-2 text-xs text-gray-700">
                  <input
                    type="checkbox"
                    className="rounded border-gray-300"
                    checked={includeDateTimeCompare}
                    onChange={(e) => setIncludeDateTimeCompare(e.target.checked)}
                  />
                  History data
                </label>
              </div>
            </div>
            {/* History Groups (desktop) */}
            {includeDateTimeCompare && compareDateTime && dateTimeData.length > 0 && (
              <>
                {/* History Public Data */}
                {Object.keys(columnStructure.public_data).length > 0 && (
                  <div className="border-b border-gray-200">
                    <button
                      onClick={(e) => {
                        if (e.target instanceof HTMLElement && e.target.closest('.three-state-checkbox')) {
                          return;
                        }
                        handleGroupClick('history-public-data');
                      }}
                      className="w-full p-4 text-left hover:bg-gray-50 flex items-center justify-between"
                    >
                      <div className="flex items-center space-x-2">
                        <span className="text-gray-400">
                          {expandedGroup === 'history-public-data' ? '▼' : '▶'}
                        </span>
                        <div className="three-state-checkbox" onClick={(e) => e.stopPropagation()}>
                          <ThreeStateCheckbox
                            state={getHistoryGroupState('history-public-data')}
                            onChange={(checked) => {
                              toggleHistoryColumnGroup('history-public-data', checked);
                            }}
                          />
                        </div>
                        <span className="font-medium text-gray-700">🌐 Public Data ({compareDateTime})</span>
                      </div>
                    </button>
                    {expandedGroup === 'history-public-data' && (
                      <div className="px-4 pb-4 space-y-2">
                        <label className="flex items-center space-x-2 text-sm text-gray-600 ml-6">
                          <input
                            type="checkbox"
                            checked={historySelectedColumns.has('history_public_timestamp')}
                            onChange={(e) => {
                              e.stopPropagation();
                              toggleHistoryColumnVisibility('history_public_timestamp', e.target.checked);
                            }}
                            className="rounded border-gray-300"
                          />
                          <span className="font-medium">📅 Timestamp</span>
                        </label>
                        {Object.keys(columnStructure.public_data).map(key => {
                          const colId = `history_public_data.${key}`;
                          return (
                            <label key={colId} className="flex items-center space-x-2 text-sm text-gray-600 ml-6">
                              <input
                                type="checkbox"
                                checked={historySelectedColumns.has(colId)}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  toggleHistoryColumnVisibility(colId, e.target.checked);
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
                {/* History Status Data */}
                {Object.keys(columnStructure.status_data).length > 0 && (
                  <div className="border-b border-gray-200">
                    <button
                      onClick={(e) => {
                        if (e.target instanceof HTMLElement && e.target.closest('.three-state-checkbox')) {
                          return;
                        }
                        handleGroupClick('history-status-data');
                      }}
                      className="w-full p-4 text-left hover:bg-gray-50 flex items-center justify-between"
                    >
                      <div className="flex items-center space-x-2">
                        <span className="text-gray-400">
                          {expandedGroup === 'history-status-data' ? '▼' : '▶'}
                        </span>
                        <div className="three-state-checkbox" onClick={(e) => e.stopPropagation()}>
                          <ThreeStateCheckbox
                            state={getHistoryGroupState('history-status-data')}
                            onChange={(checked) => {
                              toggleHistoryColumnGroup('history-status-data', checked);
                            }}
                          />
                        </div>
                        <span className="font-medium text-gray-700">📊 Status Data ({compareDateTime})</span>
                      </div>
                    </button>
                    {expandedGroup === 'history-status-data' && (
                      <div className="px-4 pb-4 space-y-2">
                        <label className="flex items-center space-x-2 text-sm text-gray-600 ml-6">
                          <input
                            type="checkbox"
                            checked={historySelectedColumns.has('history_status_timestamp')}
                            onChange={(e) => {
                              e.stopPropagation();
                              toggleHistoryColumnVisibility('history_status_timestamp', e.target.checked);
                            }}
                            className="rounded border-gray-300"
                          />
                          <span className="font-medium">📅 Timestamp</span>
                        </label>
                        {Object.keys(columnStructure.status_data).map(key => {
                          const colId = `history_status_data.${key}`;
                          return (
                            <label key={colId} className="flex items-center space-x-2 text-sm text-gray-600 ml-6">
                              <input
                                type="checkbox"
                                checked={historySelectedColumns.has(colId)}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  toggleHistoryColumnVisibility(colId, e.target.checked);
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
                {/* History Measurements */}
                {Object.keys(columnStructure.measurements_data).length > 0 && (
                  <div className="border-b border-gray-200">
                    <button
                      onClick={(e) => {
                        if (e.target instanceof HTMLElement && e.target.closest('.three-state-checkbox')) {
                          return;
                        }
                        handleGroupClick('history-measurements');
                      }}
                      className="w-full p-4 text-left hover:bg-gray-50 flex items-center justify-between"
                    >
                      <div className="flex items-center space-x-2">
                        <span className="text-gray-400">
                          {expandedGroup === 'history-measurements' ? '▼' : '▶'}
                        </span>
                        <div className="three-state-checkbox" onClick={(e) => e.stopPropagation()}>
                          <ThreeStateCheckbox
                            state={getHistoryGroupState('history-measurements')}
                            onChange={(checked) => {
                              toggleHistoryColumnGroup('history-measurements', checked);
                            }}
                          />
                        </div>
                        <span className="font-medium text-gray-700">📋 Measurements ({compareDateTime})</span>
                      </div>
                    </button>
                    {expandedGroup === 'history-measurements' && (
                      <div className="px-4 pb-4 space-y-2">
                        <label className="flex items-center space-x-2 text-sm text-gray-600 ml-6">
                          <input
                            type="checkbox"
                            checked={historySelectedColumns.has('history_measurements_timestamp')}
                            onChange={(e) => {
                              e.stopPropagation();
                              toggleHistoryColumnVisibility('history_measurements_timestamp', e.target.checked);
                            }}
                            className="rounded border-gray-300"
                          />
                          <span className="font-medium">📅 Timestamp</span>
                        </label>
                        {Object.keys(columnStructure.measurements_data).map(key => {
                          const colId = `history_measurements_data.${key}`;
                          return (
                            <label key={colId} className="flex items-center space-x-2 text-sm text-gray-600 ml-6">
                              <input
                                type="checkbox"
                                checked={historySelectedColumns.has(colId)}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  toggleHistoryColumnVisibility(colId, e.target.checked);
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
              </>
            )}
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
            suppressMovableColumns={true}
            onGridReady={onGridReady}
            onFilterChanged={onFilterChanged}
            onModelUpdated={onModelUpdated}
            animateRows={false}
            // Rows are not clickable; only Name column is clickable via cellRenderer
            suppressMenuHide={true}
            headerHeight={64}
            defaultColDef={{
              filter: true,
              sortable: true,
              resizable: true,
              floatingFilter: true,
              wrapHeaderText: true,
              headerClass: 'wrap-anywhere',
            }}
            enableBrowserTooltips={true}
          />
        </div>
      </div>
    </div>
  );
}
