'use client'

import React from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import AdvancedTable from '@/components/AdvancedTable';

export default function AdvancedPage() {
  return (
    <ProtectedRoute>
      <AdvancedPageContent />
    </ProtectedRoute>
  );
}

function AdvancedPageContent() {
  return (
    <div className="h-full bg-gray-50 p-6">
      {/* Header Section */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-gray-900">Advanced View</h1>
            <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
              415
            </span>
          </div>
          
          {/* Manual Refresh Button */}
          <button
            onClick={() => window.location.reload()}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
          >
            <svg 
              className="w-4 h-4" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh Now
          </button>
        </div>
        
        <div className="flex items-center justify-between">
          <p className="text-gray-600">Complete view with all station data tables • Auto-refreshes every 10 minutes</p>
        </div>
      </div>

      <div className="flex-1">
        <AdvancedTable 
          height="calc(100vh - 250px)"
          showControls={true}
          defaultSelectedColumns={[
            'label', 'ip_address', 'online_24h_avg', 'data_health_24h_avg',
            'latitude', 'longitude', 'altitude', 'sms_number'
          ]}
        />
      </div>
    </div>
  );
}