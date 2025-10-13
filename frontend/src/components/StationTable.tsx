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
  avg_fetch_health_24h: number;
}

interface StationTableProps {
  readonly rowData: RowData[];
  readonly onRowClick: (stationId: string) => void;
}

export default function StationTable({ rowData, onRowClick }: StationTableProps) {
  const [rowCount, setRowCount] = useState(0);
  const [filteredCount, setFilteredCount] = useState(0);
  const [isFiltered, setIsFiltered] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [gridApi, setGridApi] = useState<GridApi | null>(null);

  // Reset function to clear search, filters, and sorts
  const resetTable = () => {
    setSearchTerm('');
    if (gridApi) {
      // Reset all column filters
      gridApi.setFilterModel({});
      // Reset all sorting
      gridApi.applyColumnState({
        defaultState: { sort: null }
      });
    }
  };

  // Filter data based on search term
  const filteredData = React.useMemo(() => {
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
        String(row.avg_fetch_health_24h || '')
      ];
      return searchableValues.some(value => 
        value.toLowerCase().includes(term)
      );
    });
  }, [rowData, searchTerm]);

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
    const api = event.api;
    setRowCount(api.getDisplayedRowCount());
  };

  const onFilterChanged = (event: FilterChangedEvent) => {
    const api = event.api;
    setFilteredCount(api.getDisplayedRowCount());
    setIsFiltered(api.isAnyFilterPresent());
  };

  const columnDefs: ColDef<RowData>[] = [
    { headerName: 'ID', field: 'label_id', minWidth: 50, maxWidth: 70 },
    { headerName: 'Name', field: 'label_text', cellStyle: { fontWeight: '600', fontSize: '16px' }, minWidth: 250, flex: 1 },
    { headerName: 'Type', field: 'label_type', minWidth: 50, maxWidth: 80 },
    { headerName: 'Health (24h)', field: 'avg_data_health_24h', minWidth: 100, maxWidth: 180, valueFormatter: params => params.value != null ? `${params.value}%` : '' },
    { headerName: 'Online (24h)', field: 'avg_fetch_health_24h', minWidth: 100, maxWidth: 180, valueFormatter: params => params.value != null ? `${params.value}%` : '' },
    {
      headerName: 'Online graph (24h)',
      field: 'status',
      cellRenderer: TimelineCell,
      cellRendererParams: (params: ICellRendererParams) => ({
        timestamps: params.data.timestamps,
      }),
      sortable: false,
      filter: false,
      minWidth: 120,
      flex: 1
    }
  ];

  return (
    <div className="flex flex-col w-full" style={{ height: '100%' }}>
      {/* Search and Row Count - Aligned with Table */}
      <div className="w-full mb-4">
        <div className="max-w-5xl mx-auto">
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
            <div className="flex flex-col gap-4">
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
              <div className="text-sm text-gray-600">
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
        <div className="max-w-5xl mx-auto bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          <div className="ag-theme-alpine" style={{ height: 'calc(100vh - 320px)', minWidth: 600 }}>
            <AgGridReact
              rowData={filteredData}
              columnDefs={columnDefs}
              pagination={false}
              paginationPageSize={50}
              defaultColDef={{ sortable: true, filter: true, resizable: true, flex: 1 }}
              onGridReady={onGridReady}
              onModelUpdated={onModelUpdated}
              onFilterChanged={onFilterChanged}
              onRowClicked={event => {
                const id = event.data.id;
                console.log('Row clicked, station ID:', id);
                onRowClick(id);
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}