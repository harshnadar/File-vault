import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { fileService } from '../services/fileService';
import { useQuery } from '@tanstack/react-query';

interface StorageStatsData {
  total_files: number;
  total_references: number;
  total_size: number;
  total_space_saved: number;
  total_size_readable: string;
  total_space_saved_readable: string;
}

export interface StorageStatsProps {
  refreshKey: number;
}

export const StorageStats: React.FC<StorageStatsProps> = ({ refreshKey }) => {
  // const [stats, setStats] = useState<StorageStatsData | null>(null);
  // const [loading, setLoading] = useState<boolean>(true);
  // const [error, setError] = useState<string | null>(null);
  const { data: stats, isLoading: loading, error: queryError } = useQuery({
    queryKey: ['storage-stats', refreshKey],
    queryFn: fileService.getStorageStats,
    staleTime: 30000, // 30 seconds
  });

  const error = queryError ? 'Failed to load storage statistics' : null;

  // useEffect(() => {
  //   const fetchStats = async () => {
  //     try {
  //       setLoading(true);
  //       const response = await axios.get(
  //         `${process.env.REACT_APP_API_URL || 'http://localhost:8000/api'}/files/storage_stats/`
  //       );
  //       setStats(response.data);
  //       setError(null);
  //     } catch (err) {
  //       console.error('Error fetching storage stats:', err);
  //       setError('Failed to load storage statistics');
  //     } finally {
  //       setLoading(false);
  //     }
  //   };

  //   fetchStats();
  // }, [refreshKey]);

  if (loading) {
    return (
      <div className="p-6">
        <h2 className="text-xl font-bold text-gray-800 mb-4">Storage Analytics</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl shadow-lg overflow-hidden animate-pulse">
              <div className="h-2 w-1/3 bg-gradient-to-r from-blue-300 to-indigo-300 rounded-full"></div>
              <div className="p-5 space-y-3">
                <div className="h-3 bg-gray-200 rounded-md w-2/3"></div>
                <div className="h-6 bg-gray-200 rounded-md w-1/2"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 rounded-xl bg-red-50 border border-red-200">
        <div className="flex items-center space-x-3">
          <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-red-700 font-medium">{error}</span>
        </div>
      </div>
    );
  }

  // Calculate efficiency percentage
  const totalReferences = stats?.total_references || 0;
  const totalFiles = stats?.total_files || 1;  // Prevent division by zero
  const efficiency = totalReferences === 0 ? 0 : Math.round((totalReferences - totalFiles) / totalReferences * 100);

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-gray-800">Storage Analytics</h2>
        <div className="text-sm text-gray-500">Last updated: {new Date().toLocaleTimeString()}</div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Files Uploaded Card */}
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl shadow-lg overflow-hidden transform transition-all hover:scale-105 hover:shadow-xl">
          <div className="h-1.5 w-full bg-gradient-to-r from-blue-400 to-indigo-500"></div>
          <div className="p-5">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-gray-500">Files Uploaded</p>
                <p className="mt-2 text-3xl font-bold text-gray-800">{stats?.total_references || 0}</p>
              </div>
              <div className="p-2 bg-blue-100 rounded-lg">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Unique Files Card */}
        <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl shadow-lg overflow-hidden transform transition-all hover:scale-105 hover:shadow-xl">
          <div className="h-1.5 w-full bg-gradient-to-r from-purple-400 to-pink-500"></div>
          <div className="p-5">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-gray-500">Unique Files</p>
                <p className="mt-2 text-3xl font-bold text-gray-800">{stats?.total_files || 0}</p>
              </div>
              <div className="p-2 bg-purple-100 rounded-lg">
                <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                </svg>
              </div>
            </div>
            <div className="mt-4 flex items-center">
              <div className="text-xs font-medium text-gray-500">Deduplication Efficiency</div>
              <div className="ml-2 text-xs font-semibold text-green-600">{efficiency}%</div>
            </div>
          </div>
        </div>

        {/* Space Consumed Card */}
        <div className="bg-gradient-to-br from-teal-50 to-green-50 rounded-xl shadow-lg overflow-hidden transform transition-all hover:scale-105 hover:shadow-xl">
          <div className="h-1.5 w-full bg-gradient-to-r from-teal-400 to-green-500"></div>
          <div className="p-5">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-gray-500">Space Consumed</p>
                <p className="mt-2 text-3xl font-bold text-gray-800">{stats?.total_size_readable || '0 B'}</p>
              </div>
              <div className="p-2 bg-teal-100 rounded-lg">
                <svg className="w-5 h-5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Space Saved Card */}
        <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl shadow-lg overflow-hidden transform transition-all hover:scale-105 hover:shadow-xl">
          <div className="h-1.5 w-full bg-gradient-to-r from-amber-400 to-orange-500"></div>
          <div className="p-5">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-gray-500">Space Saved</p>
                <p className="mt-2 text-3xl font-bold text-emerald-600">{stats?.total_space_saved_readable || '0 B'}</p>
              </div>
              <div className="p-2 bg-orange-100 rounded-lg">
                <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};