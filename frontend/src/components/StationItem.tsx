import React, { useState, useEffect } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { fetchStationStatus, getAverageStatus } from '@/utils/stationHelpers';
import {
  ModuleRegistry,
  AllCommunityModule,
  ColDef,
  GridReadyEvent,
  ModelUpdatedEvent,
  FilterChangedEvent,
  GridApi,
  ICellRendererParams 
} from 'ag-grid-community';
import { Station } from '@/types/station';
import TimelineCell from '@/components/TimelineCell';

ModuleRegistry.registerModules([AllCommunityModule]);
interface RowData {
  label_id: string;
  label_text: string;
  label_type: string;
  status: number[] | 'Loading...' | 'Error';
  timestamps?: string[];
  avg_data_health_24h: number | null;
  avg_fetch_health_24h: number;
}

interface StationItemProps {
  readonly data: readonly Station[];
  readonly onRowClick: (stationId: string) => void;
}

export default function StationGrid({ data, onRowClick }: StationItemProps) {
  const [rowData, setRowData] = useState<RowData[]>(
    data.map((station) => ({
      id: station.id,
      label_id: station.label_id,
      label_text: station.label_name,
      label_type: station.label_type,
      status: 'Loading...' as const,
      timestamps: [],
      avg_data_health_24h: 0,
      avg_fetch_health_24h: 0,
    }))
  );
  
  const [gridApi, setGridApi] = useState<GridApi | null>(null);
  const [rowCount, setRowCount] = useState(0);
  const [filteredCount, setFilteredCount] = useState(0);
  const [isFiltered, setIsFiltered] = useState(false);

  useEffect(() => {
    const didCancel = false;
    const fetchAllStationStatuses = async () => {
      try {
        const hourlyData = await fetchStationStatus();
        const avgStatusData = await getAverageStatus();
        console.log(hourlyData)
        const updatedRowData = await Promise.all(
          data.map(async (station) => {
            const stationHealth = hourlyData.find(d => d.station_id === station.id);
            return {
              id: station.id,
              label_id: station.label_id,
              label_text: station.label_name,
              label_type: station.label_type,
              status: stationHealth?.hourly_avg_array?.length === 24 ? stationHealth.hourly_avg_array : ('Error' as const),
              timestamps: stationHealth?.hour_bucket_local?.length === 24 ? stationHealth.hour_bucket_local : [],
              avg_data_health_24h: avgStatusData.find(d => d.station_id === station.id)?.avg_data_health_24h || null,
              avg_fetch_health_24h: avgStatusData.find(d => d.station_id === station.id)?.avg_fetch_health_24h || 0,
            };
          })
        );
        if (!didCancel) {
          console.log('Station row data:', updatedRowData);
          setRowData(updatedRowData);
        }
      } catch (error) {
        console.error('Error fetching station statuses:', error);
      
        const errorRowData = data.map((station) => ({
          id: station.id,
          label_id: station.label_id,
          label_text: station.label_name,
          label_type: station.label_type,
          status: "Error" as 'Error',
          timestamps: [],
          avg_data_health_24h: 0,
          avg_fetch_health_24h: 0,
        }));
        setRowData(errorRowData);
      }
    };

    if (data && data.length > 0) {
      console.log('data changed, fetching statuses...', data);
      fetchAllStationStatuses();
    }
  }, [data]);

  const updateCounts = (api: GridApi, totalRows: number) => {
    const displayedCount = api.getDisplayedRowCount();
    setRowCount(totalRows);
    setFilteredCount(displayedCount);
    setIsFiltered(displayedCount !== totalRows);
  };

  const onGridReady = (params: GridReadyEvent) => {
    setGridApi(params.api);
  };

  const onModelUpdated = (params: ModelUpdatedEvent) => {
    updateCounts(params.api, rowData.length);
  };

  const onFilterChanged = (params: FilterChangedEvent) => {
    updateCounts(params.api, rowData.length);
  };

  const resetGrid = () => {
    gridApi?.setFilterModel(null);
    gridApi?.deselectAll();
    gridApi?.resetColumnState();
  };

  const columnDefs: ColDef<RowData>[] = [
    { headerName: 'ID', field: 'label_id', minWidth: 50, maxWidth: 70 },
    { headerName: 'Name', field: 'label_text', cellStyle: { fontWeight: '600', fontSize: '16px' }, minWidth:250, flex: 1 },
    { headerName: 'Type', field: 'label_type', minWidth: 50, maxWidth: 80},
    { headerName: 'Health (24h)', field: 'avg_data_health_24h', minWidth: 100, maxWidth: 180, valueFormatter : params => params.value != null ? `${params.value}%`: '' },
    { headerName: 'Online (24h)', field: 'avg_fetch_health_24h', minWidth: 100, maxWidth: 180, valueFormatter : params => params.value != null ? `${params.value}%`: '' },
    {
      headerName: 'Online graph (24h)',
      field: 'status',
      cellRenderer: TimelineCell, // Assign renderer here, not in rowData
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
    <div className="ag-theme-alpine" style={{ height: '93%', width: '100%', minWidth: 600 }}>
      <AgGridReact
        rowData={rowData}
        columnDefs={columnDefs}
        pagination={false}
        paginationPageSize={50}
        defaultColDef={{ sortable: true, filter: true, resizable: true, flex: 1 }}
        onGridReady={onGridReady}
        onModelUpdated={onModelUpdated}
        onFilterChanged={onFilterChanged}
        onRowClicked={event => {
          const id = event.data.id; // or station.id
          console.log('Row clicked, station ID:', id);
          onRowClick(id);
        }}
      />
      <div style={{ padding: 10, fontSize: 14, color: '#b1bbc5', height: '7%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button onClick={resetGrid} className='bg-gray-400 text-white px-4 py-2 rounded'>
          Reset Table
        </button>
        <div className='text-gray-500' style={{textAlign: 'right'}}>Rows: {filteredCount} of {rowCount} {isFiltered && '(Filtered)'}</div>
      </div>
    </div>

  );
}
