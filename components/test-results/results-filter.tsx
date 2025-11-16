// Status filter component for test results

import React from 'react';

export interface ResultsFilterProps {
  framework: 'playwright' | 'cypress';
  currentStatus: string | null;
  onStatusChange: (status: string | null) => void;
}

export function ResultsFilter({ framework, currentStatus, onStatusChange }: ResultsFilterProps) {
  const playwrightStatuses = [
    { value: null, label: 'All Tests' },
    { value: 'passed', label: 'Passed' },
    { value: 'failed', label: 'Failed' },
    { value: 'skipped', label: 'Skipped' },
    { value: 'timedOut', label: 'Timed Out' },
  ];

  const cypressStatuses = [
    { value: null, label: 'All Tests' },
    { value: 'passed', label: 'Passed' },
    { value: 'failed', label: 'Failed' },
    { value: 'pending', label: 'Pending' },
  ];

  const statuses = framework === 'playwright' ? playwrightStatuses : cypressStatuses;

  const handleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value;
    onStatusChange(value === '' ? null : value);
  };

  return (
    <div className="flex items-center space-x-2">
      <label htmlFor="status-filter" className="text-sm font-medium text-gray-700">
        Filter by status:
      </label>
      <select
        id="status-filter"
        value={currentStatus || ''}
        onChange={handleChange}
        className="block rounded-md border-gray-300 py-2 pl-3 pr-10 text-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
      >
        {statuses.map((status) => (
          <option key={status.value || 'all'} value={status.value || ''}>
            {status.label}
          </option>
        ))}
      </select>
    </div>
  );
}
