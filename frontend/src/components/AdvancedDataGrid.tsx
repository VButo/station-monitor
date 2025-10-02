import { useMemo } from 'react';
import { AgGridReact } from 'ag-grid-react';
import {
  ColDef,
  GridReadyEvent,
  ModelUpdatedEvent,
  FilterChangedEvent
} from 'ag-grid-community';
import { AdvancedStationData } from '@/types/station';
import TimelineCell from './TimelineCell';

interface AdvancedDataGridProps {
  filteredData: AdvancedStationData[];
  selectedColumns: Set<string>;
  columnStructure: {
    public_data: Record<string, string>;
    status_data: Record<string, string>;
    measurements_data: Record<string, string>;
  };
  onGridReady: (event: GridReadyEvent) => void;
  onModelUpdated: (event: ModelUpdatedEvent) => void;
  onFilterChanged: (event: FilterChangedEvent) => void;
  onRowClick?: (stationId: string) => void;
}

export default function AdvancedDataGrid({
  filteredData,
  selectedColumns,
  columnStructure,
  onGridReady,
  onModelUpdated,
  onFilterChanged,
  onRowClick
}: AdvancedDataGridProps) {
  
  const columnDefs: ColDef[] = useMemo(() => {
    const columns: ColDef[] = [];

    // Always pinned left columns (not configurable)
    columns.push(
      {
        headerName: 'ID',
        field: 'label_id',
        minWidth: 80,
        maxWidth: 100,
        pinned: 'left',
        lockPinned: true,
        cellClass: 'locked-col',
        suppressColumnsToolPanel: true,
        filter: 'agTextColumnFilter',
        filterParams: {
          buttons: ['reset', 'apply'],
        }
      },
      {
        headerName: 'Name',
        field: 'label_name',
        minWidth: 150,
        maxWidth: 200,
        pinned: 'left',
        lockPinned: true,
        cellClass: 'locked-col',
        suppressColumnsToolPanel: true,
        filter: 'agTextColumnFilter',
        filterParams: {
          buttons: ['reset', 'apply'],
        }
      },
      {
        headerName: 'Type',
        field: 'label_type',
        minWidth: 100,
        maxWidth: 130,
        pinned: 'left',
        lockPinned: true,
        cellClass: 'locked-col',
        suppressColumnsToolPanel: true,
        filter: 'agTextColumnFilter',
        filterParams: {
          buttons: ['reset', 'apply'],
        }
      }
    );

    // Basic station columns
    if (selectedColumns.has('label')) {
      columns.push({
        headerName: 'Label',
        field: 'label',
        minWidth: 150,
        filter: 'agTextColumnFilter',
        filterParams: {
          buttons: ['reset', 'apply'],
        }
      });
    }

    if (selectedColumns.has('latitude')) {
      columns.push({
        headerName: 'Latitude',
        field: 'latitude',
        minWidth: 120,
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
        filter: 'agNumberColumnFilter',
        filterParams: {
          buttons: ['reset', 'apply'],
        }
      });
    }

    if (selectedColumns.has('ip_address')) {
      columns.push({
        headerName: 'IP Address',
        field: 'ip_address',
        minWidth: 130,
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
        minWidth: 130,
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

    // Add dynamic public data columns if selected (timestamp first)
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

    const publicKeys = Object.keys(columnStructure.public_data);
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

    // Add dynamic status data columns if selected (timestamp first)
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

    const statusKeys = Object.keys(columnStructure.status_data);
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

    // Add dynamic measurement data columns if selected (timestamp first)
    if (selectedColumns.has('measurements_timestamp')) {
      columns.push({
        headerName: 'Measurements: Timestamp',
        field: 'measurements_timestamp',
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

    const measurementKeys = Object.keys(columnStructure.measurements_data);
    measurementKeys.forEach(key => {
      const colId = `measurements_data.${key}`;
      if (selectedColumns.has(colId)) {
        columns.push({
          headerName: `Measurement: ${key}`,
          field: colId,
          minWidth: 120,
          valueGetter: params => params.data?.measurements_data?.[key] || '',
          filter: 'agTextColumnFilter',
          filterParams: {
            buttons: ['reset', 'apply'],
          }
        });
      }
    });

    return columns;
  }, [selectedColumns, columnStructure]);

  return (
    <div className="ag-theme-alpine" style={{ height: '600px', width: '100%' }}>
      <AgGridReact
        columnDefs={columnDefs}
        rowData={filteredData}
        onGridReady={onGridReady}
        onModelUpdated={onModelUpdated}
        onFilterChanged={onFilterChanged}
        defaultColDef={{
          sortable: true,
          filter: true,
          resizable: true,
          floatingFilter: true,
        }}
        suppressMenuHide={true}
        animateRows={true}
        rowSelection="multiple"
        enableCellTextSelection={true}
        ensureDomOrder={true}
        onRowClicked={(event) => {
          if (event.data?.label_id) {
            if (onRowClick) {
              onRowClick(event.data.label_id);
            } else {
              window.location.href = `/station/${event.data.label_id}`;
            }
          }
        }}
        rowClass="cursor-pointer hover:bg-gray-50"
      />
    </div>
  );
}