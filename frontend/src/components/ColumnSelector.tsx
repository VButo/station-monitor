import { useRef, useEffect } from 'react';
import ThreeStateCheckbox from './ThreeStateCheckbox';

interface ColumnSelectorProps {
  showColumnSelector: boolean;
  selectedColumns: Set<string>;
  expandedGroup: string;
  columnStructure: {
    public_data: Record<string, string>;
    status_data: Record<string, string>;
    measurements_data: Record<string, string>;
  };
  isProcessingColumns: boolean;
  stationData: unknown[];
  asSidebar?: boolean; // New prop to control layout type
  onToggleColumnSelector: () => void;
  onToggleColumnVisibility: (columnId: string, isVisible: boolean) => void;
  onToggleColumnGroup: (groupName: string, isVisible: boolean) => void;
  onGetGroupState: (groupName: string) => 'all' | 'some' | 'none';
  onHandleGroupClick: (groupName: string) => void;
  onShowAllColumns: () => void;
  onHideAllExceptBasic: () => void;
}

export default function ColumnSelector({
  showColumnSelector,
  selectedColumns,
  expandedGroup,
  columnStructure,
  isProcessingColumns,
  stationData,
  asSidebar = false,
  onToggleColumnSelector,
  onToggleColumnVisibility,
  onToggleColumnGroup,
  onGetGroupState,
  onHandleGroupClick,
  onShowAllColumns,
  onHideAllExceptBasic
}: ColumnSelectorProps) {
  const desktopDropdownRef = useRef<HTMLDivElement>(null);
  const mobileDropdownRef = useRef<HTMLDivElement>(null);

  // Handle click outside to close dropdown - DISABLED FOR DEBUGGING
  useEffect(() => {
    // Temporarily disable all click-outside handlers to test
    return;
    
    // Only add click-outside handler for non-sidebar mode
    if (asSidebar) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      
      // Check if click is inside any of our refs
      const isInsideDesktop = desktopDropdownRef.current?.contains(target);
      const isInsideMobile = mobileDropdownRef.current?.contains(target);
      const isColumnButton = target.closest('[data-column-toggle]');
      
      if (!isInsideDesktop && !isInsideMobile && !isColumnButton) {
        onToggleColumnSelector();
      }
    };

    if (showColumnSelector) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showColumnSelector, onToggleColumnSelector, asSidebar]);

  const renderStationGroup = (isMobile = false) => (
    <div className="border-b border-gray-200">
      <div
        className={`w-full ${isMobile ? 'p-3' : 'p-4'} text-left hover:bg-gray-50 flex items-center justify-between cursor-pointer`}
        onClick={() => onHandleGroupClick('station')}
      >
        <div className="flex items-center space-x-2">
          {!isMobile && (
            <span className="text-gray-400">
              {expandedGroup === 'station' ? '▼' : '▶'}
            </span>
          )}
          <div 
            className="flex items-center"
            onClick={(e) => {
              e.stopPropagation();
              const newState = onGetGroupState('station') === 'all' ? false : true;
              onToggleColumnGroup('station', newState);
            }}
          >
            <ThreeStateCheckbox
              state={onGetGroupState('station')}
              onChange={(checked) => onToggleColumnGroup('station', checked)}
            />
          </div>
          <span className="font-medium text-gray-700">🏢 Station</span>
        </div>
        {isMobile && (
          <span className="text-gray-400">
            {expandedGroup === 'station' ? '▲' : '▼'}
          </span>
        )}
      </div>
      {expandedGroup === 'station' && (
        <div className={`${isMobile ? 'px-3 pb-3' : 'px-4 pb-4'} space-y-2 ${isMobile ? 'max-h-48 overflow-y-auto' : ''}`}>
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
                  onToggleColumnVisibility(id, e.target.checked);
                }}
                className="rounded border-gray-300"
              />
              <span>{label}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );

  const renderDataGroup = (
    groupName: 'public-data' | 'status-data' | 'measurements',
    icon: string,
    displayName: string,
    timestampKey: string,
    dataKeys: string[],
    isMobile = false
  ) => (
    <div className="border-b border-gray-200">
      <button
        onClick={(e) => {
          if (e.target instanceof HTMLElement && e.target.closest('.three-state-checkbox')) {
            return;
          }
          onHandleGroupClick(groupName);
        }}
        className={`w-full ${isMobile ? 'p-3' : 'p-4'} text-left hover:bg-gray-50 flex items-center justify-between`}
      >
        <div className="flex items-center space-x-2">
          {!isMobile && (
            <span className="text-gray-400">
              {expandedGroup === groupName ? '▼' : '▶'}
            </span>
          )}
          <span className="three-state-checkbox">
            <ThreeStateCheckbox
              state={onGetGroupState(groupName)}
              onChange={(checked) => onToggleColumnGroup(groupName, checked)}
            />
          </span>
          <span className="font-medium text-gray-700">{icon} {displayName} ({dataKeys.length})</span>
        </div>
        {isMobile && (
          <span className="text-gray-400">
            {expandedGroup === groupName ? '▲' : '▼'}
          </span>
        )}
      </button>
      {expandedGroup === groupName && (
        <div className={`${isMobile ? 'px-3 pb-3' : 'px-4 pb-4'} space-y-2 ${isMobile ? 'max-h-48 overflow-y-auto' : ''}`}>
          {/* Timestamp column first */}
          <label className="flex items-center space-x-2 text-sm text-gray-600 ml-6">
            <input
              type="checkbox"
              checked={selectedColumns.has(timestampKey)}
              onChange={(e) => {
                e.stopPropagation();
                onToggleColumnVisibility(timestampKey, e.target.checked);
              }}
              className="rounded border-gray-300"
            />
            <span className="font-medium">📅 Timestamp</span>
          </label>
          {/* Other data columns */}
          {dataKeys.map(key => {
            const colId = `${groupName === 'measurements' ? 'measurements_data' : groupName.replace('-', '_')}.${key}`;
            return (
              <label key={colId} className="flex items-center space-x-2 text-sm text-gray-600 ml-6">
                <input
                  type="checkbox"
                  checked={selectedColumns.has(colId)}
                  onChange={(e) => {
                    e.stopPropagation();
                    onToggleColumnVisibility(colId, e.target.checked);
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
  );

  if (!showColumnSelector) return null;

  // Sidebar layout for desktop when requested
  if (asSidebar) {
    return (
      <div 
        ref={desktopDropdownRef} 
        className="w-80 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden flex flex-col"
        style={{ height: '600px' }}
      >
        <div className="p-4 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
          <h3 className="font-medium text-gray-900">Column Visibility</h3>
          <button
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onToggleColumnSelector();
            }}
            className="text-gray-400 hover:text-gray-600 text-lg leading-none"
          >
            ×
          </button>
        </div>

        <div className="p-4 border-b border-gray-200 bg-gray-50 flex-shrink-0">
          <div className="flex gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                console.log('Show All button clicked');
                onShowAllColumns();
              }}
              disabled={isProcessingColumns}
              className="px-3 py-1.5 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Show All
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                console.log('Basic View button clicked');
                onHideAllExceptBasic();
              }}
              disabled={isProcessingColumns}
              className="px-3 py-1.5 text-xs bg-gray-500 text-white rounded hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Basic View
            </button>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto">
          {/* Station Group */}
          {renderStationGroup()}

          {/* Public Data Group */}
          {stationData.length > 0 && Object.keys(columnStructure.public_data).length > 0 &&
            renderDataGroup('public-data', '🌐', 'Public Data', 'public_timestamp', Object.keys(columnStructure.public_data))
          }

          {/* Status Data Group */}
          {stationData.length > 0 && Object.keys(columnStructure.status_data).length > 0 &&
            renderDataGroup('status-data', '📊', 'Status Data', 'status_timestamp', Object.keys(columnStructure.status_data))
          }

          {/* Measurements Data Group */}
          {stationData.length > 0 && Object.keys(columnStructure.measurements_data).length > 0 &&
            renderDataGroup('measurements', '📈', 'Measurements', 'measurements_timestamp', Object.keys(columnStructure.measurements_data))
          }
        </div>
      </div>
    );
  }

  // Original dropdown layout

  return (
    <>
      {/* Desktop Column Selector */}
      <div className="hidden sm:block">
        <div 
          ref={desktopDropdownRef}
          className="absolute top-full right-0 mt-2 w-80 bg-white rounded-lg border border-gray-300 shadow-lg z-50 flex flex-col max-h-[70vh]"
        >
          <div className="p-4 border-b border-gray-200 bg-gray-50 rounded-t-lg">
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-semibold text-gray-900">Column Visibility</h3>
              <button
                onClick={onToggleColumnSelector}
                className="text-gray-400 hover:text-gray-600 text-lg"
              >
                ×
              </button>
            </div>
            <div className="flex gap-2">
              <button
                onClick={onShowAllColumns}
                disabled={isProcessingColumns}
                className="px-3 py-1.5 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Show All
              </button>
              <button
                onClick={onHideAllExceptBasic}
                disabled={isProcessingColumns}
                className="px-3 py-1.5 text-xs bg-gray-500 text-white rounded hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Basic View
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            <div>
              {/* Station Group */}
              {renderStationGroup()}

              {/* Public Data Group */}
              {stationData.length > 0 && Object.keys(columnStructure.public_data).length > 0 &&
                renderDataGroup('public-data', '🌐', 'Public Data', 'public_timestamp', Object.keys(columnStructure.public_data))
              }

              {/* Status Data Group */}
              {stationData.length > 0 && Object.keys(columnStructure.status_data).length > 0 &&
                renderDataGroup('status-data', '📊', 'Status Data', 'status_timestamp', Object.keys(columnStructure.status_data))
              }

              {/* Measurements Group */}
              {stationData.length > 0 && Object.keys(columnStructure.measurements_data).length > 0 &&
                renderDataGroup('measurements', '📈', 'Measurements', 'measurements_timestamp', Object.keys(columnStructure.measurements_data))
              }
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Column Selector */}
      <div className="sm:hidden">
        <button 
          type="button"
          className="fixed inset-0 bg-black bg-opacity-25 z-40" 
          onClick={onToggleColumnSelector}
          aria-label="Close column selector"
        ></button>
        <div 
          ref={mobileDropdownRef}
          className="fixed bottom-0 left-0 right-0 bg-white rounded-t-xl shadow-lg z-50 max-h-[80vh] flex flex-col"
        >
          <div className="p-3 border-b border-gray-200 bg-gray-50 rounded-t-xl">
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-semibold text-gray-900">Column Visibility</h3>
              <button
                onClick={onToggleColumnSelector}
                className="text-gray-400 hover:text-gray-600 text-lg"
              >
                ×
              </button>
            </div>
            <div className="flex gap-2">
              <button
                onClick={onShowAllColumns}
                disabled={isProcessingColumns}
                className="px-3 py-1.5 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Show All
              </button>
              <button
                onClick={onHideAllExceptBasic}
                disabled={isProcessingColumns}
                className="px-3 py-1.5 text-xs bg-gray-500 text-white rounded hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Basic View
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-hidden">
            <div className="h-full overflow-y-auto">
              {/* Station Group */}
              {renderStationGroup(true)}

              {/* Public Data Group */}
              {stationData.length > 0 && Object.keys(columnStructure.public_data).length > 0 &&
                renderDataGroup('public-data', '🌐', 'Public Data', 'public_timestamp', Object.keys(columnStructure.public_data), true)
              }

              {/* Status Data Group */}
              {stationData.length > 0 && Object.keys(columnStructure.status_data).length > 0 &&
                renderDataGroup('status-data', '📊', 'Status Data', 'status_timestamp', Object.keys(columnStructure.status_data), true)
              }

              {/* Measurements Group */}
              {stationData.length > 0 && Object.keys(columnStructure.measurements_data).length > 0 &&
                renderDataGroup('measurements', '📈', 'Measurements', 'measurements_timestamp', Object.keys(columnStructure.measurements_data), true)
              }
            </div>
          </div>
        </div>
      </div>
    </>
  );
}