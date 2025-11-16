'use client';

import React from 'react';
import { Search, X } from 'lucide-react';

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function SearchInput({ value, onChange, placeholder = 'Search...' }: SearchInputProps) {
  return (
    <div className="relative">
      <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
        <Search className="h-4 w-4 text-gray-400 dark:text-gray-500" />
      </div>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 py-2 pl-10 pr-10 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400"
      />
      {value && (
        <button
          onClick={() => onChange('')}
          className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
