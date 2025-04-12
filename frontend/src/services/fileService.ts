import axios from 'axios';
import { File as FileType } from '../types/file';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';

// Define the paginated response interface
interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

// Define parameters for getFiles
interface GetFilesParams {
  page?: number;
  search?: string;
  filename?: string;
  file_type?: string;
  min_size?: number;
  max_size?: number;
  date_after?: number; // Changed to number for epoch milliseconds
  date_before?: number; // Changed to number for epoch milliseconds
}

export const fileService = {
  async uploadFile(file: File): Promise<FileType> {
    // Check file size before uploading (10MB = 10 * 1024 * 1024 bytes)
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB in bytes
    
    if (file.size > MAX_FILE_SIZE) {
      throw new Error(`Maximum file size allowed is 10MB. Your file is ${(file.size / (1024 * 1024)).toFixed(2)}MB`);
    }
    const formData = new FormData();
    formData.append('file', file);

    const response = await axios.post(`${API_URL}/files/`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  async getFiles(params: GetFilesParams = {}): Promise<PaginatedResponse<FileType>> {
    const { page = 1, search, filename, file_type, min_size, max_size, date_after, date_before } = params;
    
    // Build query parameters
    const queryParams = new URLSearchParams();
    queryParams.append('page', page.toString());
    
    if (search) queryParams.append('search', search);
    if (filename) queryParams.append('filename', filename);
    if (file_type) queryParams.append('file_type', file_type);
    if (min_size !== undefined) queryParams.append('min_size', min_size.toString());
    if (max_size !== undefined) queryParams.append('max_size', max_size.toString());
    if (date_after) queryParams.append('date_after_epoch', date_after.toString());
    if (date_before) queryParams.append('date_before_epoch', date_before.toString());
    
    const response = await axios.get(`${API_URL}/files/?${queryParams.toString()}`);
    return response.data;
  },

  async deleteFile(id: string): Promise<void> {
    await axios.delete(`${API_URL}/files/${id}/`);
  },

  async getStorageStats(): Promise<any> {
    const response = await axios.get(`${API_URL}/files/storage_stats/`);
    return response.data;
  },

  async downloadFile(fileUrl: string, filename: string): Promise<void> {
    try {
      const response = await axios.get(fileUrl, {
        responseType: 'blob',
      });
      
      // Create a blob URL and trigger download
      const blob = new Blob([response.data]);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download error:', error);
      throw new Error('Failed to download file');
    }
  },

  async getFileTypes(): Promise<string[]> {
    try {
      const response = await axios.get(`${API_URL}/files/file_types/`);
      return response.data.file_types || [];
    } catch (error) {
      console.error('Error fetching file types:', error);
      return [];
    }
  },
};