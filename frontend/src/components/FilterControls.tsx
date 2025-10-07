import { useState, useRef, useEffect } from 'react';

interface FilterControlsProps {
  searchTerm: string;
  selectedType: string;
  healthFilter: string;
  showFilters: boolean;
  uniqueTypes: string[];
  onSearchChange: (value: string) => void;
  onTypeChange: (value: string) => void;
  onHealthFilterChange: (value: string) => void;
  onToggleFilters: () => void;
  onClearFilters: () => void;
}

export default function FilterControls({
  searchTerm,
  selectedType,
  healthFilter,
  showFilters,
  uniqueTypes,
  onSearchChange,
  onTypeChange,
  onHealthFilterChange,
  onToggleFilters,
  onClearFilters
}: Readonly<FilterControlsProps>) {
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);
  const [showHealthDropdown, setShowHealthDropdown] = useState(false);

  const typeDropdownRef = useRef<HTMLDivElement>(null);
  const healthDropdownRef = useRef<HTMLDivElement>(null);

  // Handle click outside to close dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      
      if (typeDropdownRef.current && !typeDropdownRef.current.contains(target)) {
        setShowTypeDropdown(false);
      }
      
      if (healthDropdownRef.current && !healthDropdownRef.current.contains(target)) {
        setShowHealthDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const hasActiveFilters = searchTerm || selectedType || healthFilter;

  return (
    <div className="mb-4 space-y-3">
      {/* Filter Toggle Button */}
      <div className="flex justify-between items-center">
        <button
          onClick={onToggleFilters}
          className="flex items-center space-x-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
        >
          <span>🔍</span>
          <span>Filters</span>
          <span className={`transform transition-transform ${showFilters ? 'rotate-180' : ''}`}>
            ▼
          </span>
          {hasActiveFilters && (
            <span className="bg-blue-500 text-white text-xs px-2 py-1 rounded-full">
              Active
            </span>
          )}
        </button>
        
        {hasActiveFilters && (
          <button
            onClick={onClearFilters}
            className="px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            Clear All
          </button>
        )}
      </div>

      {/* Filter Controls */}
      {showFilters && (
        <div className="bg-gray-50 p-4 rounded-lg space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Search Input */}
            <div className="space-y-1">
              <label htmlFor="search-stations" className="block text-sm font-medium text-gray-700">
                Search Stations
              </label>
              <input
                id="search-stations"
                type="text"
                placeholder="Search by name, ID, or location..."
                value={searchTerm}
                onChange={(e) => onSearchChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Type Filter */}
            <div className="space-y-1 relative" ref={typeDropdownRef}>
              <span className="block text-sm font-medium text-gray-700">
                Station Type
              </span>
              <button
                onClick={() => setShowTypeDropdown(!showTypeDropdown)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-left bg-white hover:bg-gray-50 flex justify-between items-center"
                aria-expanded={showTypeDropdown}
                aria-haspopup="listbox"
              >
                <span className={selectedType ? 'text-gray-900' : 'text-gray-500'}>
                  {selectedType || 'All Types'}
                </span>
                <span className={`transform transition-transform ${showTypeDropdown ? 'rotate-180' : ''}`}>
                  ▼
                </span>
              </button>
              
              {showTypeDropdown && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto">
                  <button
                    onClick={() => {
                      onTypeChange('');
                      setShowTypeDropdown(false);
                    }}
                    className={`w-full px-3 py-2 text-left hover:bg-gray-50 ${!selectedType ? 'bg-blue-50 text-blue-700' : ''}`}
                  >
                    All Types
                  </button>
                  {uniqueTypes.map(type => (
                    <button
                      key={type}
                      onClick={() => {
                        onTypeChange(type);
                        setShowTypeDropdown(false);
                      }}
                      className={`w-full px-3 py-2 text-left hover:bg-gray-50 ${selectedType === type ? 'bg-blue-50 text-blue-700' : ''}`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Health Filter */}
            <div className="space-y-1 relative" ref={healthDropdownRef}>
              <span className="block text-sm font-medium text-gray-700">
                Health Status
              </span>
              <button
                onClick={() => setShowHealthDropdown(!showHealthDropdown)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-left bg-white hover:bg-gray-50 flex justify-between items-center"
                aria-expanded={showHealthDropdown}
                aria-haspopup="listbox"
              >
                <span className={healthFilter ? 'text-gray-900' : 'text-gray-500'}>
                  {healthFilter || 'All Health Status'}
                </span>
                <span className={`transform transition-transform ${showHealthDropdown ? 'rotate-180' : ''}`}>
                  ▼
                </span>
              </button>
              
              {showHealthDropdown && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-50">
                  <button
                    onClick={() => {
                      onHealthFilterChange('');
                      setShowHealthDropdown(false);
                    }}
                    className={`w-full px-3 py-2 text-left hover:bg-gray-50 ${!healthFilter ? 'bg-blue-50 text-blue-700' : ''}`}
                  >
                    All Health Status
                  </button>
                  {[
                    { value: 'healthy', label: '🟢 Healthy (>80%)', color: 'text-green-700' },
                    { value: 'warning', label: '🟡 Warning (50-80%)', color: 'text-yellow-700' },
                    { value: 'critical', label: '🔴 Critical (<50%)', color: 'text-red-700' }
                  ].map(({ value, label, color }) => (
                    <button
                      key={value}
                      onClick={() => {
                        onHealthFilterChange(value);
                        setShowHealthDropdown(false);
                      }}
                      className={`w-full px-3 py-2 text-left hover:bg-gray-50 ${healthFilter === value ? 'bg-blue-50 text-blue-700' : color}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}