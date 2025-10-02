import { useRef, useEffect } from 'react';
import * as ExcelJS from 'exceljs';

interface ExportDropdownProps {
  showExportDropdown: boolean;
  filteredData: unknown[];
  onToggleExportDropdown: () => void;
}

export default function ExportDropdown({
  showExportDropdown,
  filteredData,
  onToggleExportDropdown
}: ExportDropdownProps) {
  const exportDropdownRef = useRef<HTMLDivElement>(null);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      
      if (exportDropdownRef.current && !exportDropdownRef.current.contains(target)) {
        const isExportButton = target.closest('[data-export-toggle]');
        if (!isExportButton) {
          onToggleExportDropdown();
        }
      }
    };

    if (showExportDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showExportDropdown, onToggleExportDropdown]);

  // CSV Export Function
  const exportToCSV = () => {
    const csvContent = [
      // Header row
      Object.keys(filteredData[0] as Record<string, unknown>).join(','),
      // Data rows
      ...filteredData.map(row => 
        Object.values(row as Record<string, unknown>)
          .map(value => 
            typeof value === 'string' && value.includes(',') 
              ? `"${value}"` 
              : String(value || '')
          )
          .join(',')
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `station_data_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    onToggleExportDropdown();
  };

  // Excel Export Function
  const exportToExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Station Data');

    if (filteredData.length === 0) return;

    const firstRow = filteredData[0] as Record<string, unknown>;
    const headers = Object.keys(firstRow);
    
    // Add headers
    const headerRow = worksheet.addRow(headers);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    };

    // Add data
    filteredData.forEach(row => {
      const rowData = headers.map(header => (row as Record<string, unknown>)[header] || '');
      worksheet.addRow(rowData);
    });

    // Auto-fit columns
    worksheet.columns.forEach(column => {
      if (column.values) {
        const lengths = column.values
          .filter(value => value !== null && value !== undefined)
          .map(value => String(value).length);
        const maxLength = Math.max(...lengths);
        column.width = Math.min(Math.max(maxLength, 10), 50);
      }
    });

    // Generate Excel file
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { 
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
    });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `station_data_${new Date().toISOString().split('T')[0]}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    onToggleExportDropdown();
  };

  if (!showExportDropdown) return null;

  return (
    <div 
      ref={exportDropdownRef}
      className="absolute top-full right-0 mt-2 w-48 bg-white rounded-lg border border-gray-300 shadow-lg z-50"
    >
      <div className="py-2">
        <button
          onClick={exportToCSV}
          disabled={filteredData.length === 0}
          className="w-full px-4 py-2 text-left hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
        >
          <span>📄</span>
          <span>Export as CSV</span>
        </button>
        <button
          onClick={exportToExcel}
          disabled={filteredData.length === 0}
          className="w-full px-4 py-2 text-left hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
        >
          <span>📊</span>
          <span>Export as Excel</span>
        </button>
      </div>
    </div>
  );
}