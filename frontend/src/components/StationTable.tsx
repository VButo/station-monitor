import React, { useState, useEffect } from 'react';
import { AgGridReact } from 'ag-grid-react';
import {
  ModuleRegistry,
  AllCommunityModule,
  ColDef,
  GridReadyEvent,
  ModelUpdatedEvent,
  FilterChangedEvent,
  ICellRendererParams,
  GridApi
} from 'ag-grid-community';
import TimelineCell from '@/components/TimelineCell';

ModuleRegistry.registerModules([AllCommunityModule]);

export interface RowData {
  id: number;
  label_id: string;
  label_text: string;
  label_type: string;
  status: number[] | 'Loading...' | 'Error';
  timestamps?: string[];
  avg_data_health_24h: number | null;
  avg_network_health_24h: number;
}

interface StationTableProps {
  readonly rowData: RowData[];
  readonly onRowClick: (stationId: string) => void;
}

function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024); // lg breakpoint in Tailwind
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return isMobile;
}

function formatPercent(value: number | null | undefined): string {
  return value === null || value === undefined ? '' : `${value}%`;
}

function createColumnDefs(isMobile: boolean, onRowClick: (stationId: string) => void): ColDef<RowData>[] {
  const idCol: ColDef<RowData> = {
    headerName: 'ID',
    field: 'label_id',
    minWidth: isMobile ? 70 : 50,
    width: isMobile ? 80 : undefined,
    maxWidth: isMobile ? 90 : 70
  };

  const nameCellRenderer = (params: ICellRendererParams) => {
    const id = params.data?.id;
    return (
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          try {
            onRowClick(String(id));
          } catch (err) {
            console.error('Error navigating to station:', err);
          }
        }}
        className="text-lg underline text-gray-900 bg-transparent border-none p-0 cursor-pointer"
      >
        {params.value}
      </button>
    );
  };

  const nameCol: ColDef<RowData> = {
    headerName: 'Name',
    field: 'label_text',
    cellStyle: { fontWeight: '600', fontSize: '16px' },
    minWidth: isMobile ? 150 : 250,
    width: isMobile ? 200 : undefined,
    flex: isMobile ? undefined : 1,
    cellRenderer: nameCellRenderer
  };

  const typeCol: ColDef<RowData> = {
    headerName: 'Type',
    field: 'label_type',
    minWidth: isMobile ? 70 : 50,
    width: isMobile ? 90 : undefined,
    maxWidth: isMobile ? 100 : 80
  };

  const makePercentCol = (headerName: string, field: keyof RowData): ColDef<RowData> => ({
    headerName,
    field,
    minWidth: isMobile ? 90 : 100,
    width: isMobile ? 110 : undefined,
    maxWidth: isMobile ? 130 : 180,
    valueFormatter: params => formatPercent(params.value)
  });

  const timelineCol: ColDef<RowData> = {
    headerName: 'Online graph (24h)',
    field: 'status',
    cellRenderer: TimelineCell,
    cellRendererParams: (params: ICellRendererParams) => ({
      timestamps: params.data.timestamps,
    }),
    sortable: false,
    filter: false,
    minWidth: isMobile ? 200 : 180,
    width: isMobile ? 250 : undefined,
    flex: isMobile ? undefined : 2
  };

  return [
    idCol,
    nameCol,
    typeCol,
    makePercentCol('Health (24h)', 'avg_data_health_24h'),
    makePercentCol('Online (24h)', 'avg_network_health_24h'),
    timelineCol
  ];
}

function useFilteredData(rowData: RowData[], searchTerm: string) {
  return React.useMemo(() => {
    if (!searchTerm.trim()) {
      return rowData;
    }

    const term = searchTerm.toLowerCase();
    return rowData.filter(row => {
      const searchableValues = [
        row.label_text,
        row.label_type,
        row.label_id,
        String(row.id),
        String(row.avg_data_health_24h || ''),
        String(row.avg_network_health_24h || '')
      ];
      return searchableValues.some(value => 
        value.toLowerCase().includes(term)
      );
    });
  }, [rowData, searchTerm]);
}

export default function StationTable({ rowData, onRowClick }: StationTableProps) {
  const isMobile = useIsMobile();

  const [rowCount, setRowCount] = useState(0);
  const [filteredCount, setFilteredCount] = useState(0);
  const [isFiltered, setIsFiltered] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [gridApi, setGridApi] = useState<GridApi | null>(null);

  const filteredData = useFilteredData(rowData, searchTerm);
  const columnDefs = React.useMemo(() => createColumnDefs(isMobile, onRowClick), [isMobile, onRowClick]);

  // Update counts when filteredData changes
  useEffect(() => {
    setRowCount(rowData.length);
    setFilteredCount(filteredData.length);
    setIsFiltered(searchTerm.trim() !== '');
  }, [rowData, filteredData, searchTerm]);

  const onGridReady = (params: GridReadyEvent) => {
    setGridApi(params.api);
    setRowCount(params.api.getDisplayedRowCount());
    setFilteredCount(params.api.getDisplayedRowCount());
  };

  const onModelUpdated = (event: ModelUpdatedEvent) => {
    setRowCount(event.api.getDisplayedRowCount());
  };

  const onFilterChanged = (event: FilterChangedEvent) => {
    setFilteredCount(event.api.getDisplayedRowCount());
    setIsFiltered(event.api.isAnyFilterPresent());
  };

  // Reset function to clear search, filters, and sorts
  const resetTable = () => {
    setSearchTerm('');
    if (gridApi) {
      gridApi.setFilterModel({});
      gridApi.applyColumnState({
        defaultState: { sort: null }
      });
    }
  };

  return (
    <div className="flex flex-col w-full" style={{ height: '100%' }}>
      {/* Search and Row Count - Aligned with Table */}
      <div className="w-full mb-4">
        <div className="max-w-5xl mx-auto">
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              {/* Search and Reset row */}
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
                  onClick={resetTable}
                  className="text-sm text-gray-500 hover:text-gray-700 underline whitespace-nowrap"
                >
                  Reset
                </button>
              </div>

              {/* Station count row */}
              <div className="text-sm text-gray-600 whitespace-nowrap">
                {isFiltered ? (
                  <>Showing {filteredCount} of {rowCount} stations</>
                ) : (
                  <>{rowCount} stations</>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Table Container - Constrained Width */}
      <div className="flex-1 w-full">
        <div className={`${isMobile ? 'overflow-x-auto' : 'max-w-5xl mx-auto'} bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden`}>
          <div 
            className="ag-theme-alpine" 
            style={{ 
              height: '64vh', 
              minWidth: isMobile ? '800px' : '600px',
              width: isMobile ? 'max-content' : '100%'
            }}
          >
            <AgGridReact
              rowData={filteredData}
              columnDefs={columnDefs}
              pagination={false}
              paginationPageSize={50}
              // Disable column dragging/reordering
              suppressMovableColumns={true}
              defaultColDef={{ 
                sortable: true, 
                filter: true, 
                resizable: true, 
                flex: isMobile ? undefined : 1,
                minWidth: isMobile ? 80 : 50,
                suppressSizeToFit: isMobile
              }}
              onGridReady={onGridReady}
              onModelUpdated={onModelUpdated}
              onFilterChanged={onFilterChanged}
              // Rows are not clickable; only the Name cell will navigate
              suppressHorizontalScroll={false}
              alwaysShowHorizontalScroll={isMobile}
            />
          </div>
        </div>
      </div>
    </div>
  );
}