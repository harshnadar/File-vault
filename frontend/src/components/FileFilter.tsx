import React, { useState, useEffect, useRef } from 'react';
import { FunnelIcon, XMarkIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { format } from 'date-fns';
import useDebounce from '../hooks/useDebounce';

export interface FileFilterProps {
  onFilterChange: (filters: FilterCriteria) => void;
  fileTypes: string[];
}

export interface FilterCriteria {
  searchTerm: string;
  fileTypes: string[];
  sizeRange: [number, number]; // [min, max] in bytes
  dateRange: [Date | null, Date | null]; // [start, end]
}

export const FileFilter: React.FC<FileFilterProps> = ({ onFilterChange, fileTypes }) => {
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [activeFilterCount, setActiveFilterCount] = useState(0);
  const [searchInputValue, setSearchInputValue] = useState('');
  const isInitialMount = useRef(true);
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  
  const [filters, setFilters] = useState<FilterCriteria>({
    searchTerm: '',
    fileTypes: [],
    sizeRange: [0, Infinity],
    dateRange: [null, null],
  });

  // Add state to track UI feedback for auto adjustments
  const [showSizeAdjustment, setShowSizeAdjustment] = useState(false);
  const [showDateAdjustment, setShowDateAdjustment] = useState(false);

  // Debounce search term to prevent excessive API calls
  const debouncedSearchTerm = useDebounce(searchInputValue, 800); // 800ms delay
  
  // Update search term filter when debounced value changes
  useEffect(() => {
    // Skip the first effect call to prevent initial double-fetch
    if (debouncedSearchTerm.length < 2) return; 
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    
    const newFilters = { ...filters, searchTerm: debouncedSearchTerm };
    setFilters(newFilters);
    onFilterChange(newFilters);
  }, [debouncedSearchTerm]); // Removed the filters dependency
  
  // Calculate active filter count
  useEffect(() => {
    let count = 0;
    if (filters.searchTerm) count++;
    if (filters.fileTypes.length > 0) count++;
    if (filters.sizeRange[0] > 0 || filters.sizeRange[1] < Infinity) count++;
    if (filters.dateRange[0] || filters.dateRange[1]) count++;
    
    setActiveFilterCount(count);
  }, [filters]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Update local state immediately for UI feedback
    setSearchInputValue(e.target.value);
    // The actual filter change will happen via the debounced value effect
  };

  const handleFileTypeToggle = (fileType: string) => {
    const newFileTypes = filters.fileTypes.includes(fileType)
      ? filters.fileTypes.filter(type => type !== fileType)
      : [...filters.fileTypes, fileType];
    
    const newFilters = { ...filters, fileTypes: newFileTypes };
    setFilters(newFilters);
    onFilterChange(newFilters);
  };

  const handleSizeChange = (min: number, max: number) => {
    // Ensure max size is never less than min size
    const needsAdjustment = min > max;
    const validatedMax = needsAdjustment ? min : max;
    
    const newFilters = { ...filters, sizeRange: [min, validatedMax] as [number, number] };
    setFilters(newFilters);
    onFilterChange(newFilters);
    
    // Show adjustment feedback if needed
    if (needsAdjustment) {
      setShowSizeAdjustment(true);
      // Hide after 3 seconds
      setTimeout(() => setShowSizeAdjustment(false), 3000);
    }
  };

  const handleDateChange = (start: Date | null, end: Date | null) => {
    let adjustedStart = start;
    let adjustedEnd = end;
    
    // Check if adjustment is needed
    let needsAdjustment = false;

    if (adjustedStart) {
      adjustedStart = new Date(adjustedStart);
      adjustedStart.setHours(0, 0, 0, 0); // Start of day
    }
    
    // If both dates are provided, ensure end date is not before start date
    if (start && end && start > end) {
      needsAdjustment = true;
      // If user sets an invalid range, set the end date equal to start date
      adjustedEnd = new Date(start);
    }
    
    // Set end of day for end date to include the full day
    if (adjustedEnd) {
      adjustedEnd = new Date(adjustedEnd);
      adjustedEnd.setHours(23, 59, 59, 999); // End of day
    }
    
    const newFilters = { ...filters, dateRange: [adjustedStart, adjustedEnd] as [Date | null, Date | null] };
    setFilters(newFilters);
    onFilterChange(newFilters);
    
    // Show adjustment feedback if needed
    if (needsAdjustment) {
      setShowDateAdjustment(true);
      // Hide after 3 seconds
      setTimeout(() => setShowDateAdjustment(false), 3000);
    }
  };

  const clearFilters = () => {
    setSearchInputValue('');
    const newFilters: FilterCriteria = {
      searchTerm: '',
      fileTypes: [],
      sizeRange: [0, Infinity] as [number, number],
      dateRange: [null, null],
    };
    setFilters(newFilters);
    onFilterChange(newFilters);
  };

  // Format size for display (KB, MB, GB)
  const formatSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    if (bytes === Infinity) return 'Any size';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="bg-white rounded-md shadow p-4 mb-6">
      {/* Search bar - always visible */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />
        </div>
        <input
          type="text"
          className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
          placeholder="Search files by name..."
          value={searchInputValue}
          onChange={handleSearchChange}
        />
        {searchInputValue && (
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
            <button
              onClick={() => setSearchInputValue('')}
              className="text-gray-400 hover:text-gray-500 focus:outline-none"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>
        )}
      </div>

      {/* Filter panel toggle */}
      <div className="flex justify-between items-center mt-4">
        <button
          type="button"
          onClick={() => setIsFilterOpen(!isFilterOpen)}
          className="inline-flex items-center text-sm text-gray-700 hover:text-primary-600"
        >
          <FunnelIcon className="mr-1.5 h-5 w-5" aria-hidden="true" />
          Filters
          {activeFilterCount > 0 && (
            <span className="ml-1.5 py-0.5 px-2 rounded-full text-xs bg-primary-100 text-primary-800">
              {activeFilterCount}
            </span>
          )}
        </button>
        
        {activeFilterCount > 0 && (
          <button
            type="button"
            onClick={clearFilters}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Clear all
          </button>
        )}
      </div>

      {/* Expandable filter panel */}
      {isFilterOpen && (
        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* File Type Filter */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-gray-700">File Types</h3>
            <div className="space-y-1 max-h-48 overflow-y-auto p-2 border border-gray-200 rounded bg-gray-50">
              {fileTypes.length > 0 ? (
                fileTypes.map((type) => (
                  <div key={type} className="flex items-center">
                    <input
                      id={`filter-type-${type}`}
                      type="checkbox"
                      checked={filters.fileTypes.includes(type)}
                      onChange={() => handleFileTypeToggle(type)}
                      className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                    />
                    <label htmlFor={`filter-type-${type}`} className="ml-2 text-sm text-gray-600">
                      {type}
                    </label>
                  </div>
                ))
              ) : (
                <div className="text-sm text-gray-500 italic">No file types available</div>
              )}
            </div>
          </div>

          {/* Size Range Filter */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-gray-700">Size Range</h3>
            <div className={`p-2 border ${showSizeAdjustment ? 'border-amber-300 bg-amber-50' : 'border-gray-200 bg-gray-50'} rounded transition-colors duration-300 space-y-4`}>
              <div>
                <label htmlFor="min-size" className="block text-xs text-gray-500 mb-1">
                  Min Size
                </label>
                <select
                  id="min-size"
                  value={filters.sizeRange[0]}
                  onChange={(e) => handleSizeChange(Number(e.target.value), filters.sizeRange[1])}
                  className={`w-full rounded-md border-gray-300 py-2 text-sm shadow-sm focus:border-primary-500 focus:ring-primary-500 ${showSizeAdjustment ? 'border-amber-300' : ''}`}
                >
                  <option value="0">No minimum</option>
                  <option value="1024">1 KB</option>
                  <option value="102400">100 KB</option>
                  <option value="512000">500 KB</option>
                  <option value="1048576">1 MB</option>
                  <option value="5242880">5 MB</option>
                </select>
              </div>
              
              <div>
                <label htmlFor="max-size" className="block text-xs text-gray-500 mb-1">
                  Max Size
                </label>
                <select
                  id="max-size"
                  value={filters.sizeRange[1]}
                  onChange={(e) => handleSizeChange(filters.sizeRange[0], Number(e.target.value))}
                  className={`w-full rounded-md border-gray-300 py-2 text-sm shadow-sm focus:border-primary-500 focus:ring-primary-500 ${showSizeAdjustment ? 'border-amber-300' : ''}`}
                >
                  <option value="1048576">1 MB</option>
                  <option value="5242880">5 MB</option>
                  <option value="10485760">10 MB</option>
                  <option value="Infinity">No maximum</option>
                </select>
              </div>
              
              {showSizeAdjustment && (
                <div className="text-xs text-amber-600 bg-amber-50 p-1 rounded border border-amber-200 animate-pulse">
                  Max size adjusted to match minimum size
                </div>
              )}
              
              {filters.sizeRange[0] > 0 || filters.sizeRange[1] < Infinity ? (
                <div className="text-xs text-primary-600">
                  {formatSize(filters.sizeRange[0])} - {formatSize(filters.sizeRange[1])}
                </div>
              ) : null}
            </div>
          </div>

          {/* Date Range Filter */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-gray-700">Upload Date</h3>
            <div className={`p-2 border ${showDateAdjustment ? 'border-amber-300 bg-amber-50' : 'border-gray-200 bg-gray-50'} rounded transition-colors duration-300 space-y-4`}>
              <div>
                <label htmlFor="start-date" className="block text-xs text-gray-500 mb-1">
                  From
                </label>
                <input
                    type="date"
                    id="start-date"
                    max={today}
                    value={filters.dateRange[0] ? format(filters.dateRange[0], 'yyyy-MM-dd') : ''}
                    onChange={(e) => {
                        const date = e.target.value ? new Date(e.target.value) : null;
                        handleDateChange(date, filters.dateRange[1]);
                    }}
                    className={`w-full rounded-md border-gray-300 py-2 text-sm shadow-sm focus:border-primary-500 focus:ring-primary-500 ${showDateAdjustment ? 'border-amber-300' : ''}`}
                />
              </div>
              
              <div>
                <label htmlFor="end-date" className="block text-xs text-gray-500 mb-1">
                  To
                </label>
                <input
                    type="date"
                    id="end-date"
                    max={today}
                    value={filters.dateRange[1] ? format(filters.dateRange[1], 'yyyy-MM-dd') : ''}
                    onChange={(e) => {
                        const date = e.target.value ? new Date(e.target.value) : null;
                        handleDateChange(filters.dateRange[0], date);
                    }}
                    className={`w-full rounded-md border-gray-300 py-2 text-sm shadow-sm focus:border-primary-500 focus:ring-primary-500 ${showDateAdjustment ? 'border-amber-300' : ''}`}
                />
              </div>
              
              {showDateAdjustment && (
                <div className="text-xs text-amber-600 bg-amber-50 p-1 rounded border border-amber-200 animate-pulse">
                  End date adjusted to match start date
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* Active filters display */}
      {activeFilterCount > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {filters.searchTerm && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
              Search: {filters.searchTerm}
              <button
                type="button"
                onClick={() => {
                  setSearchInputValue('');
                }}
                className="ml-1 flex-shrink-0 inline-flex text-gray-400 hover:text-gray-500"
              >
                <XMarkIcon className="h-4 w-4" aria-hidden="true" />
              </button>
            </span>
          )}
          
          {filters.fileTypes.map(type => (
            <span key={type} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              Type: {type}
              <button
                type="button"
                onClick={() => handleFileTypeToggle(type)}
                className="ml-1 flex-shrink-0 inline-flex text-blue-400 hover:text-blue-500"
              >
                <XMarkIcon className="h-4 w-4" aria-hidden="true" />
              </button>
            </span>
          ))}
          
          {(filters.sizeRange[0] > 0 || filters.sizeRange[1] < Infinity) && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
              Size: {formatSize(filters.sizeRange[0])} - {formatSize(filters.sizeRange[1])}
              <button
                type="button"
                onClick={() => {
                  const newFilters = { ...filters, sizeRange: [0, Infinity] as [number, number] };
                  setFilters(newFilters);
                  onFilterChange(newFilters);
                }}
                className="ml-1 flex-shrink-0 inline-flex text-green-400 hover:text-green-500"
              >
                <XMarkIcon className="h-4 w-4" aria-hidden="true" />
              </button>
            </span>
          )}
          
          {(filters.dateRange[0] || filters.dateRange[1]) && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
              Date: {filters.dateRange[0] ? format(filters.dateRange[0], 'MMM d, yyyy') : 'Any'} - {filters.dateRange[1] ? format(filters.dateRange[1], 'MMM d, yyyy') : 'Any'}
              <button
                type="button"
                onClick={() => {
                  const newFilters = { ...filters, dateRange: [null, null] as [Date | null, Date | null] };
                  setFilters(newFilters);
                  onFilterChange(newFilters);
                }}
                className="ml-1 flex-shrink-0 inline-flex text-amber-400 hover:text-amber-500"
              >
                <XMarkIcon className="h-4 w-4" aria-hidden="true" />
              </button>
            </span>
          )}
        </div>
      )}
    </div>
  );
};