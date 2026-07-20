"use client";

import { useState, useCallback } from 'react';
import { apiClient, type FileUploadResponse, type MultipleFileUploadResponse, type FileUploadLimits } from '@/lib/api-client';

export interface UseFileUploadOptions {
  onProgress?: (progress: number) => void;
  onSuccess?: (response: FileUploadResponse | MultipleFileUploadResponse) => void;
  onError?: (error: string) => void;
  maxSize?: number;
  allowedTypes?: string[];
}

export interface UseFileUploadResult {
  uploadImage: (file: File) => Promise<FileUploadResponse | null>;
  uploadMultipleImages: (files: File[]) => Promise<MultipleFileUploadResponse | null>;
  uploadDocument: (file: File) => Promise<FileUploadResponse | null>;
  uploadAnyFile: (file: File) => Promise<FileUploadResponse | null>;
  deleteFile: (filePath: string) => Promise<boolean>;
  getUploadLimits: () => Promise<FileUploadLimits | null>;
  isUploading: boolean;
  progress: number;
  error: string | null;
  validateFile: (file: File, type: 'image' | 'document' | 'any') => { isValid: boolean; error?: string };
  formatFileSize: (bytes: number) => string;
}

export function useFileUpload(options: UseFileUploadOptions = {}): UseFileUploadResult {
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const { onProgress, onSuccess, onError, maxSize, allowedTypes } = options;

  const validateFile = useCallback((
    file: File, 
    type: 'image' | 'document' | 'any'
  ): { isValid: boolean; error?: string } => {
    // Check file size
    if (maxSize && file.size > maxSize) {
      return {
        isValid: false,
        error: `File size must be less than ${formatFileSize(maxSize)}`
      };
    }

    // Check file type
    if (allowedTypes && !allowedTypes.includes(file.type)) {
      return {
        isValid: false,
        error: `File type ${file.type} is not allowed`
      };
    }

    // Type-specific validation
    if (type === 'image' && !file.type.startsWith('image/')) {
      return {
        isValid: false,
        error: 'Please select an image file'
      };
    }

    return { isValid: true };
  }, [maxSize, allowedTypes]);

  const formatFileSize = useCallback((bytes: number): string => {
    if (bytes === 0) return '0 KB';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  }, []);

  const uploadImage = useCallback(async (file: File): Promise<FileUploadResponse | null> => {
    const validation = validateFile(file, 'image');
    if (!validation.isValid) {
      const errorMsg = validation.error || 'Invalid file';
      setError(errorMsg);
      onError?.(errorMsg);
      return null;
    }

    setIsUploading(true);
    setError(null);
    setProgress(0);

    try {
      // Simulate progress for better UX
      const progressInterval = setInterval(() => {
        setProgress(prev => {
          const newProgress = Math.min(prev + 10, 90);
          onProgress?.(newProgress);
          return newProgress;
        });
      }, 100);

      const response = await apiClient.uploadImage(file);

      clearInterval(progressInterval);
      setProgress(100);
      onProgress?.(100);

      if (response.success && response.data) {
        onSuccess?.(response.data);
        return response.data;
      } else {
        throw new Error(response.error?.message || 'Upload failed');
      }
    } catch (err: any) {
      const errorMsg = err.message || 'Failed to upload image';
      setError(errorMsg);
      onError?.(errorMsg);
      return null;
    } finally {
      setIsUploading(false);
      setTimeout(() => setProgress(0), 1000);
    }
  }, [validateFile, onProgress, onSuccess, onError]);

  const uploadMultipleImages = useCallback(async (files: File[]): Promise<MultipleFileUploadResponse | null> => {
    // Validate all files
    for (const file of files) {
      const validation = validateFile(file, 'image');
      if (!validation.isValid) {
        const errorMsg = validation.error || 'Invalid file';
        setError(errorMsg);
        onError?.(errorMsg);
        return null;
      }
    }

    setIsUploading(true);
    setError(null);
    setProgress(0);

    try {
      const progressInterval = setInterval(() => {
        setProgress(prev => {
          const newProgress = Math.min(prev + 5, 90);
          onProgress?.(newProgress);
          return newProgress;
        });
      }, 200);

      const response = await apiClient.uploadMultipleImages(files);

      clearInterval(progressInterval);
      setProgress(100);
      onProgress?.(100);

      if (response.success && response.data) {
        onSuccess?.(response.data);
        return response.data;
      } else {
        throw new Error(response.error?.message || 'Upload failed');
      }
    } catch (err: any) {
      const errorMsg = err.message || 'Failed to upload images';
      setError(errorMsg);
      onError?.(errorMsg);
      return null;
    } finally {
      setIsUploading(false);
      setTimeout(() => setProgress(0), 1000);
    }
  }, [validateFile, onProgress, onSuccess, onError]);

  const uploadDocument = useCallback(async (file: File): Promise<FileUploadResponse | null> => {
    const validation = validateFile(file, 'document');
    if (!validation.isValid) {
      const errorMsg = validation.error || 'Invalid file';
      setError(errorMsg);
      onError?.(errorMsg);
      return null;
    }

    setIsUploading(true);
    setError(null);
    setProgress(0);

    try {
      const progressInterval = setInterval(() => {
        setProgress(prev => {
          const newProgress = Math.min(prev + 10, 90);
          onProgress?.(newProgress);
          return newProgress;
        });
      }, 100);

      const response = await apiClient.uploadDocument(file);

      clearInterval(progressInterval);
      setProgress(100);
      onProgress?.(100);

      if (response.success && response.data) {
        onSuccess?.(response.data);
        return response.data;
      } else {
        throw new Error(response.error?.message || 'Upload failed');
      }
    } catch (err: any) {
      const errorMsg = err.message || 'Failed to upload document';
      setError(errorMsg);
      onError?.(errorMsg);
      return null;
    } finally {
      setIsUploading(false);
      setTimeout(() => setProgress(0), 1000);
    }
  }, [validateFile, onProgress, onSuccess, onError]);

  const uploadAnyFile = useCallback(async (file: File): Promise<FileUploadResponse | null> => {
    const validation = validateFile(file, 'any');
    if (!validation.isValid) {
      const errorMsg = validation.error || 'Invalid file';
      setError(errorMsg);
      onError?.(errorMsg);
      return null;
    }

    setIsUploading(true);
    setError(null);
    setProgress(0);

    try {
      const progressInterval = setInterval(() => {
        setProgress(prev => {
          const newProgress = Math.min(prev + 10, 90);
          onProgress?.(newProgress);
          return newProgress;
        });
      }, 100);

      const response = await apiClient.uploadAnyFile(file);

      clearInterval(progressInterval);
      setProgress(100);
      onProgress?.(100);

      if (response.success && response.data) {
        onSuccess?.(response.data);
        return response.data;
      } else {
        throw new Error(response.error?.message || 'Upload failed');
      }
    } catch (err: any) {
      const errorMsg = err.message || 'Failed to upload file';
      setError(errorMsg);
      onError?.(errorMsg);
      return null;
    } finally {
      setIsUploading(false);
      setTimeout(() => setProgress(0), 1000);
    }
  }, [validateFile, onProgress, onSuccess, onError]);

  const deleteFile = useCallback(async (filePath: string): Promise<boolean> => {
    try {
      const response = await apiClient.deleteFile(filePath);
      return response.success;
    } catch (err: any) {
      const errorMsg = err.message || 'Failed to delete file';
      setError(errorMsg);
      onError?.(errorMsg);
      return false;
    }
  }, [onError]);

  const getUploadLimits = useCallback(async (): Promise<FileUploadLimits | null> => {
    try {
      const response = await apiClient.getUploadLimits();
      if (response.success && response.data) {
        return response.data;
      }
      return null;
    } catch (err: any) {
      const errorMsg = err.message || 'Failed to get upload limits';
      setError(errorMsg);
      onError?.(errorMsg);
      return null;
    }
  }, [onError]);

  return {
    uploadImage,
    uploadMultipleImages,
    uploadDocument,
    uploadAnyFile,
    deleteFile,
    getUploadLimits,
    isUploading,
    progress,
    error,
    validateFile,
    formatFileSize,
  };
}