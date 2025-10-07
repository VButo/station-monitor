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

ModuleRegistry.registerModules([AllCommunityModule]);

interface AdvancedTableProps {
  className?: string;
  height?: string;
  onRowClick?: (stationId: number) => void;
  defaultSelectedColumns?: string[];
  showControls?: boolean;
}

export default function AdvancedTable({
  className = "",
  height = "600px",
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
  const [selectedColumns, setSelectedColumns] = useState<Set<string>>(new Set(defaultSelectedColumns));
  const [showExportDropdown, setShowExportDropdown] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  const columnSelectorRef = useRef<HTMLDivElement>(null);
  const exportDropdownRef = useRef<HTMLDivElement>(null);

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
        
        if (res.data && res.data.stations) {
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

    fetchStationData();
  }, []);

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
    setTimeout(() => {
      updateCounts();
    }, 100);
  }, [updateCounts]);

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

  const showAllColumns = useCallback(() => {
    const allColumnIds = new Set([
      // Basic columns
      'label', 'latitude', 'longitude', 'altitude', 'ip_address', 'sms_number',
      'online_24h_avg', 'data_health_24h_avg',
      // Public data columns
      ...Object.keys(columnStructure.public_data).map(key => `public_data.${key}`),
      // Status data columns  
      ...Object.keys(columnStructure.status_data).map(key => `status_data.${key}`),
      // Measurements columns
      'measurements_timestamp',
      ...Object.keys(columnStructure.measurements_data).map(key => `measurements_data.${key}`)
    ]);
    setSelectedColumns(allColumnIds);
  }, [columnStructure]);

  const hideAllColumns = useCallback(() => {
    setSelectedColumns(new Set());
  }, []);

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
      worksheet.columns.forEach(column => {
        if (column.values) {
          const lengths = column.values.map(v => v ? v.toString().length : 10);
          column.width = Math.max(...lengths) + 2;
        }
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
      if (columnSelectorRef.current && !columnSelectorRef.current.contains(event.target as Node)) {
        setShowColumnSelector(false);
      }
      if (exportDropdownRef.current && !exportDropdownRef.current.contains(event.target as Node)) {
        setShowExportDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Generate column definitions
  const columnDefs = useMemo((): ColDef[] => {
    if (stationData.length === 0 || !columnStructure.public_data || Object.keys(columnStructure.public_data).length === 0) return [];

    const columns: ColDef[] = [];

    // Always include pinned basic columns
    columns.push({
      headerName: 'ID',
      field: 'label_id',
      pinned: 'left',
      minWidth: 80,
      maxWidth: 100,
      cellStyle: { fontWeight: '600' },
      filter: 'agNumberColumnFilter',
      filterParams: { buttons: ['reset', 'apply'] }
    });

    columns.push({
      headerName: 'Name',
      field: 'label_name',
      pinned: 'left',
      minWidth: 200,
      flex: 1,
      cellStyle: { fontWeight: '600', fontSize: '16px' },
      filter: 'agTextColumnFilter',
      filterParams: { buttons: ['reset', 'apply'], debounceMs: 300 }
    });

    columns.push({
      headerName: 'Type',
      field: 'label_type',
      pinned: 'left',
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

    // Dynamic public data columns
    Object.keys(columnStructure.public_data).forEach(key => {
      const colId = `public_data.${key}`;
      if (selectedColumns.has(colId)) {
        columns.push({
          headerName: key,
          field: colId,
          minWidth: 120,
          valueGetter: params => params.data.public_data?.[key] || '',
          filter: 'agTextColumnFilter',
          filterParams: { buttons: ['reset', 'apply'] }
        });
      }
    });

    // Dynamic status data columns
    Object.keys(columnStructure.status_data).forEach(key => {
      const colId = `status_data.${key}`;
      if (selectedColumns.has(colId)) {
        columns.push({
          headerName: key,
          field: colId,
          minWidth: 120,
          valueGetter: params => params.data.status_data?.[key] || '',
          filter: 'agTextColumnFilter',
          filterParams: { buttons: ['reset', 'apply'] }
        });
      }
    });

    // Measurements timestamp
    if (selectedColumns.has('measurements_timestamp')) {
      columns.push({
        headerName: 'Measurements Timestamp',
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
        filterParams: { buttons: ['reset', 'apply'] }
      });
    }

    // Dynamic measurements data columns
    Object.keys(columnStructure.measurements_data).forEach(key => {
      const colId = `measurements_data.${key}`;
      if (selectedColumns.has(colId)) {
        columns.push({
          headerName: key,
          field: colId,
          minWidth: 120,
          valueGetter: params => params.data.measurements_data?.[key] || '',
          filter: 'agTextColumnFilter',
          filterParams: { buttons: ['reset', 'apply'] }
        });
      }
    });

    return columns;
  }, [selectedColumns, columnStructure, stationData.length]);

  if (loading) {
    return (
      <div className={`flex items-center justify-center ${className}`} style={{ height }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading station data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`flex items-center justify-center ${className}`} style={{ height }}>
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
    <div className={`flex flex-col ${className}`} style={{ height }}>
      {showControls && (
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-4">
          {/* Search and Row Count */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
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

            <div className="text-sm text-gray-600 whitespace-nowrap">
              {isFiltered ? (
                <>Showing {filteredCount} of {rowCount} stations</>
              ) : (
                <>{rowCount} stations</>
              )}
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2">
            {/* Column Selector */}
            <div className="relative" ref={columnSelectorRef}>
              <button
                onClick={() => setShowColumnSelector(!showColumnSelector)}
                className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                Columns
              </button>
              
              {showColumnSelector && (
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-xl border border-gray-200 z-50 max-h-96 overflow-y-auto">
                  <div className="p-4 border-b border-gray-200">
                    <div className="flex gap-2 mb-3">
                      <button
                        onClick={showAllColumns}
                        className="px-3 py-1 text-xs font-medium text-blue-600 bg-blue-50 rounded hover:bg-blue-100"
                      >
                        Show All
                      </button>
                      <button
                        onClick={hideAllColumns}
                        className="px-3 py-1 text-xs font-medium text-gray-600 bg-gray-50 rounded hover:bg-gray-100"
                      >
                        Hide All
                      </button>
                    </div>
                  </div>

                  <div className="p-4 space-y-4">
                    {/* Basic Columns */}
                    <div>
                      <h4 className="font-medium text-gray-800 mb-2">📍 Basic Info</h4>
                      <div className="space-y-2 ml-4">
                        {['label', 'latitude', 'longitude', 'altitude', 'ip_address', 'sms_number'].map(col => (
                          <label key={col} className="flex items-center space-x-2 text-sm text-gray-600">
                            <input
                              type="checkbox"
                              checked={selectedColumns.has(col)}
                              onChange={(e) => toggleColumnVisibility(col, e.target.checked)}
                              className="rounded border-gray-300"
                            />
                            <span>{col.replace('_', ' ')}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* Health Columns */}
                    <div>
                      <h4 className="font-medium text-gray-800 mb-2">💚 Health</h4>
                      <div className="space-y-2 ml-4">
                        {['online_24h_avg', 'data_health_24h_avg'].map(col => (
                          <label key={col} className="flex items-center space-x-2 text-sm text-gray-600">
                            <input
                              type="checkbox"
                              checked={selectedColumns.has(col)}
                              onChange={(e) => toggleColumnVisibility(col, e.target.checked)}
                              className="rounded border-gray-300"
                            />
                            <span>{col.replace('_', ' ')}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* Public Data */}
                    {Object.keys(columnStructure.public_data).length > 0 && (
                      <div>
                        <h4 className="font-medium text-gray-800 mb-2">🌐 Public Data</h4>
                        <div className="space-y-2 ml-4">
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

                    {/* Status Data */}
                    {Object.keys(columnStructure.status_data).length > 0 && (
                      <div>
                        <h4 className="font-medium text-gray-800 mb-2">📊 Status Data</h4>
                        <div className="space-y-2 ml-4">
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

                    {/* Measurements */}
                    {Object.keys(columnStructure.measurements_data).length > 0 && (
                      <div>
                        <h4 className="font-medium text-gray-800 mb-2">📈 Measurements</h4>
                        <div className="space-y-2 ml-4">
                          <label className="flex items-center space-x-2 text-sm text-gray-600">
                            <input
                              type="checkbox"
                              checked={selectedColumns.has('measurements_timestamp')}
                              onChange={(e) => toggleColumnVisibility('measurements_timestamp', e.target.checked)}
                              className="rounded border-gray-300"
                            />
                            <span className="font-medium">📅 Timestamp</span>
                          </label>
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

            {/* Export Dropdown */}
            <div className="relative" ref={exportDropdownRef}>
              <button
                onClick={() => setShowExportDropdown(!showExportDropdown)}
                className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                Export
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
      )}

      {/* Table */}
      <div 
        className="ag-theme-alpine" 
        style={{ 
          height: showControls ? 'calc(100% - 80px)' : '100%',
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
  );
}