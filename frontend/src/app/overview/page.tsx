'use client'
import { useState, useEffect } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute'
import { getTestVariable, updateTestVariable } from '@/utils/api';

function OverviewPageContent() {
  const [testVariable, setTestVariable] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Load initial value from backend
  useEffect(() => {
    const loadTestVariable = async () => {
      try {
        setLoading(true);
        setError(null);
        const value = await getTestVariable();
        setTestVariable(value);
      } catch (err) {
        console.error('Failed to load test variable:', err);
        setError('Failed to load test variable');
      } finally {
        setLoading(false);
      }
    };

    loadTestVariable();
  }, []);

  // Handle input changes and sync to backend
  const handleInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setTestVariable(newValue); // Optimistic update
    
    try {
      setError(null);
      // Sync to backend
      await updateTestVariable(newValue);
    } catch (err) {
      console.error('Failed to update test variable:', err);
      setError('Failed to save changes');
      // Could revert the optimistic update here if needed
    }
  };

  return (
    <div className="h-full bg-gray-50 flex flex-col">
      <div className="flex-1 p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Overview</h1>
        
        {/* Simple Text Field Section */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Test Input Field</h2>
          
          {error && (
            <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
              {error}
            </div>
          )}
          
          <div className="space-y-4">
            <div>
              <label htmlFor="test-input" className="block text-sm font-medium text-gray-700 mb-2">
                Test Variable:
              </label>
              <input
                id="test-input"
                type="text"
                value={testVariable}
                onChange={handleInputChange}
                placeholder={loading ? "Loading..." : "Enter some text..."}
                disabled={loading}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              />
            </div>
            
            <div className="mt-4 p-4 bg-gray-100 rounded-md">
              <p className="text-sm text-gray-600">Current value:</p>
              <p className="text-lg font-mono text-gray-900">&ldquo;{testVariable}&rdquo;</p>
            </div>
          </div>
        </div>

        <p className="text-gray-600">Overview page content coming soon...</p>
      </div>
    </div>
  );
}

export default function OverviewPage() {
  return (
    <ProtectedRoute>
      <OverviewPageContent />
    </ProtectedRoute>
  );
}
