/**
 * API Search Components
 * Search components that work with API pagination
 */

"use client";

import React from 'react';
import { SearchLg, X } from '@untitledui/icons';
import { Input } from '@/components/base/input/input';
import { Button } from '@/components/base/buttons/button';

export interface ApiSearchProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  placeholder?: string;
  isSearching?: boolean;
  className?: string;
}

/**
 * Search input component that works with API search hooks
 */
export function ApiSearch({
  searchQuery,
  onSearchChange,
  placeholder = 'Search...',
  isSearching = false,
  className = '',
}: ApiSearchProps) {
  const handleClear = () => {
    onSearchChange('');
  };

  return (
    <div className={`relative ${className}`}>
      <div className="relative">
        <SearchLg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder={placeholder}
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
        />
        {searchQuery && (
          <button
            onClick={handleClear}
            aria-label="Clear search"
            className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1 rounded-full hover:bg-gray-100"
          >
            <X className="w-3 h-3 text-gray-400" />
          </button>
        )}
      </div>
      
      {isSearching && (
        <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-600"></div>
        </div>
      )}
    </div>
  );
}

export interface ApiSearchWithFiltersProps extends ApiSearchProps {
  filters?: React.ReactNode;
  filtersPosition?: 'right' | 'below';
}

/**
 * Search component with additional filters
 */
export function ApiSearchWithFilters({
  searchQuery,
  onSearchChange,
  placeholder = 'Search...',
  isSearching = false,
  filters,
  filtersPosition = 'right',
  className = '',
}: ApiSearchWithFiltersProps) {
  if (filtersPosition === 'below') {
    return (
      <div className={`space-y-4 ${className}`}>
        <ApiSearch
          searchQuery={searchQuery}
          onSearchChange={onSearchChange}
          placeholder={placeholder}
          isSearching={isSearching}
        />
        {filters && (
          <div className="flex flex-wrap gap-2">
            {filters}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-4 ${className}`}>
      <div className="flex-1">
        <ApiSearch
          searchQuery={searchQuery}
          onSearchChange={onSearchChange}
          placeholder={placeholder}
          isSearching={isSearching}
        />
      </div>
      {filters && (
        <div className="flex items-center gap-2">
          {filters}
        </div>
      )}
    </div>
  );
}