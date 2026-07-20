import { Platform } from 'react-native';
import { ApiService } from './api.service';
import type { 
  FileUploadResponse, 
  MultipleFileUploadResponse, 
  FileUploadLimits,
  ApiResponse 
} from '@/types/api.types';

export interface FileUploadOptions {
  onProgress?: (progress: number) => void;
  signal?: AbortSignal;
}

export interface ImagePickerAsset {
  uri: string;
  type?: string | null;
  name?: string;
  size?: number;
}

class FileUploadService extends ApiService {
  /**
   * Get upload configuration limits
   */
  async getUploadLimits(): Promise<ApiResponse<FileUploadLimits>> {
    return this.get<FileUploadLimits>('/upload/limits');
  }

  /**
   * Upload a single image
   */
  async uploadImage(
    imageUri: string, 
    options?: FileUploadOptions
  ): Promise<ApiResponse<FileUploadResponse>> {
    const formData = new FormData();
    
    if (imageUri.startsWith('blob:') || imageUri.startsWith('data:')) {
      // Web platform - fetch blob and append directly
      try {
        const response = await fetch(imageUri);
        const blob = await response.blob();
        
        const filename = this.extractFilenameFromUri(imageUri);
        const mimeType = this.getMimeTypeFromUri(imageUri, 'image');
        const fileExtension = this.getFileExtensionFromMimeType(mimeType);
        const finalFilename = filename.includes('.') ? filename : `${filename}${fileExtension}`;
        
        formData.append('image', blob, finalFilename);
      } catch (error) {
        throw new Error('Failed to process image for upload');
      }
    } else {
      // React Native - use improved file object format
      const fileInfo = this.createFileFromUri(imageUri, 'image');
      formData.append('image', fileInfo as any);
    }

    return this.uploadFile('/upload/image', formData, options);
  }

  /**
   * Upload multiple images
   */
  async uploadMultipleImages(
    imageUris: string[], 
    options?: FileUploadOptions
  ): Promise<ApiResponse<MultipleFileUploadResponse>> {
    const formData = new FormData();
    
    // Process all URIs
    const processPromises = imageUris.map(async (uri, index) => {
      if (uri.startsWith('blob:') || uri.startsWith('data:')) {
        // Web platform - fetch blob and append
        try {
          const response = await fetch(uri);
          const blob = await response.blob();
          const filename = this.extractFilenameFromUri(uri);
          const mimeType = this.getMimeTypeFromUri(uri, 'image');
          const fileExtension = this.getFileExtensionFromMimeType(mimeType);
          const finalFilename = filename.includes('.') ? filename : `${filename}${fileExtension}`;

          return { type: 'blob', data: blob, filename: finalFilename };
        } catch (error) {
          return null;
        }
      } else {
        // React Native - use improved file object format
        const fileInfo = this.createFileFromUri(uri, 'image', `image_${index}`);
        return { type: 'object', data: fileInfo };
      }
    });
    
    const processedResults = await Promise.all(processPromises);
    
    // Append to FormData
    processedResults.forEach((processed) => {
      if (processed) {
        if (processed.type === 'blob') {
          formData.append('images', processed.data, processed.filename);
        } else {
          formData.append('images', processed.data as any);
        }
      }
    });

    return this.uploadFile('/upload/images', formData, options);
  }

  /**
   * Upload a document
   */
  async uploadDocument(
    documentUri: string, 
    options?: FileUploadOptions
  ): Promise<ApiResponse<FileUploadResponse>> {
    const formData = new FormData();
    
    if (documentUri.startsWith('blob:') || documentUri.startsWith('data:')) {
      // Web platform - fetch blob and append directly
      try {
        const response = await fetch(documentUri);
        const blob = await response.blob();
        
        const filename = this.extractFilenameFromUri(documentUri);
        const mimeType = this.getMimeTypeFromUri(documentUri, 'document');
        const fileExtension = this.getFileExtensionFromMimeType(mimeType, 'document');
        const finalFilename = filename.includes('.') ? filename : `${filename}${fileExtension}`;
        
        formData.append('document', blob, finalFilename);
      } catch (error) {
        throw new Error('Failed to process document for upload');
      }
    } else {
      // React Native - use file object format
      const fileInfo = this.createFileFromUri(documentUri, 'document');
      formData.append('document', fileInfo as any);
    }

    return this.uploadFile('/upload/document', formData, options);
  }

  /**
   * Upload a document from DocumentPicker asset
   */
  async uploadDocumentFromAsset(
    asset: any, 
    options?: FileUploadOptions
  ): Promise<ApiResponse<FileUploadResponse>> {
    const formData = new FormData();
    
    // Handle web vs React Native differently
    const filename = asset.name || this.extractFilenameFromUri(asset.uri);
    const mimeType = asset.type || this.getMimeTypeFromUri(asset.uri, 'document');
    
    if (asset.uri.startsWith('blob:') || asset.uri.startsWith('data:')) {
      // Web platform - fetch blob and append directly
      try {
        const response = await fetch(asset.uri);
        const blob = await response.blob();
        
        // Ensure we have a proper filename with extension
        const fileExtension = this.getFileExtensionFromMimeType(mimeType, 'document');
        const finalFilename = filename.includes('.') ? filename : `${filename}${fileExtension}`;
        
        formData.append('document', blob, finalFilename);
      } catch (error) {
        throw new Error('Failed to process document for upload');
      }
    } else {
      // React Native - use file object format
      const fileToUpload = {
        uri: asset.uri,
        type: mimeType,
        name: filename,
      };
      
      formData.append('document', fileToUpload as any);
    }

    return this.uploadFile('/upload/document', formData, options);
  }

  /**
   * Upload any file type
   */
  async uploadAnyFile(
    fileUri: string, 
    options?: FileUploadOptions
  ): Promise<ApiResponse<FileUploadResponse>> {
    const formData = new FormData();
    
    const fileInfo = this.createFileFromUri(fileUri, 'file');
    formData.append('file', fileInfo as any);

    return this.uploadFile('/upload/file', formData, options);
  }

  /**
   * Delete an uploaded file
   */
  async deleteFile(filePath: string): Promise<ApiResponse<null>> {
    return this.delete('/upload/delete', { path: filePath });
  }

  /**
   * Upload images from ImagePicker assets
   */
  async uploadImagesFromAssets(
    assets: ImagePickerAsset[], 
    options?: FileUploadOptions
  ): Promise<ApiResponse<MultipleFileUploadResponse>> {
    const formData = new FormData();
    
    // Process all assets first
    const processPromises = assets.map(async (asset, index) => {
      if (asset.uri.startsWith('blob:')) {
        // Web platform - fetch blob and append directly
        try {
          const response = await fetch(asset.uri);
          const blob = await response.blob();
          const filename = asset.name || this.extractFilenameFromUri(asset.uri);
          const mimeType = asset.type || this.getMimeTypeFromUri(asset.uri, 'image');
          const fileExtension = this.getFileExtensionFromMimeType(mimeType);
          const finalFilename = filename.includes('.') ? filename : `${filename}${fileExtension}`;

          return { type: 'blob', data: blob, filename: finalFilename };
        } catch (error) {
            return null;
        }
      } else {
        // React Native - use file object format
        const fileInfo = this.createFileFromAsset(asset, `image_${index}`);
        return { type: 'object', data: fileInfo };
      }
    });
    
    const processedAssets = await Promise.all(processPromises);
    
    // Append processed assets to FormData
    processedAssets.forEach((processed, index) => {
      if (processed) {
        if (processed.type === 'blob') {
          formData.append('images', processed.data, processed.filename);
        } else {
          formData.append('images', processed.data as any);
        }
      }
    });

    return this.uploadFile('/upload/images', formData, options);
  }

  /**
   * Upload single image from ImagePicker asset
   */
  async uploadImageFromAsset(
    asset: ImagePickerAsset, 
    options?: FileUploadOptions
  ): Promise<ApiResponse<FileUploadResponse>> {
    const formData = new FormData();
    
    // Handle web vs React Native differently
    if (asset.uri.startsWith('blob:')) {
      // Web platform - fetch blob and append directly
      try {
        const response = await fetch(asset.uri);
        const blob = await response.blob();
        
        const filename = asset.name || this.extractFilenameFromUri(asset.uri);
        const mimeType = asset.type || this.getMimeTypeFromUri(asset.uri, 'image');
        
        // Ensure we have a proper filename with extension
        const fileExtension = this.getFileExtensionFromMimeType(mimeType);
        const finalFilename = filename.includes('.') ? filename : `${filename}${fileExtension}`;
        
        formData.append('image', blob, finalFilename);
      } catch (error) {
        throw new Error('Failed to process image for upload');
      }
    } else {
      // React Native - use improved file object format
      const fileInfo = this.createFileFromAsset(asset);
      formData.append('image', fileInfo as any);
    }

    return this.uploadFile('/upload/image', formData, options);
  }

  /**
   * Create file object from URI
   */
  private createFileFromUri(uri: string, type: string, name?: string): any {
    const filename = name || this.extractFilenameFromUri(uri);
    const mimeType = this.getMimeTypeFromUri(uri, type);
    
    // Ensure filename has an extension
    const finalFilename = filename.includes('.') ? filename : `${filename}${this.getFileExtensionFromMimeType(mimeType, type)}`;
    
    // Android-specific URI normalization if needed
    let normalizedUri = uri;
    if (Platform.OS === 'android' && !uri.startsWith('file://') && !uri.startsWith('content://')) {
      normalizedUri = `file://${uri}`;
    }

    return {
      uri: normalizedUri,
      type: mimeType,
      name: finalFilename,
    };
  }

  /**
   * Create file object from ImagePicker asset
   */
  private createFileFromAsset(asset: any, name?: string): any {
    const uri = asset.uri;
    
    // Handle mime type - ImagePicker.type is often just 'image', not a mime type
    // New versions of Expo provide asset.mimeType
    let mimeType = asset.mimeType;
    
    if (!mimeType || mimeType === 'image') {
      mimeType = this.getMimeTypeFromUri(uri, 'image');
    }
    
    const filename = name || asset.fileName || asset.name || this.extractFilenameFromUri(uri);
    
    // Ensure filename has an extension
    const finalFilename = filename.includes('.') ? filename : `${filename}${this.getFileExtensionFromMimeType(mimeType)}`;
    
    // Android-specific URI normalization
    let normalizedUri = uri;
    if (Platform.OS === 'android' && !uri.startsWith('file://') && !uri.startsWith('content://')) {
      normalizedUri = `file://${uri}`;
    }
    
    return {
      uri: normalizedUri,
      type: mimeType,
      name: finalFilename,
    };
  }

  /**
   * Extract filename from URI
   */
  private extractFilenameFromUri(uri: string): string {
    // Handle content:// URIs on Android
    if (uri.startsWith('content://')) {
      const parts = uri.split('/');
      const lastPart = parts[parts.length - 1];
      // Content URIs often have IDs at the end without extensions
      // Try to extract extension from the mime type if available, otherwise use jpg as default
      return `${lastPart}.jpg`;
    }

    const parts = uri.split('/');
    const filename = parts[parts.length - 1];

    // If no extension, add appropriate one
    if (!filename.includes('.')) {
      return `${filename}.jpg`;
    }

    return filename;
  }

  /**
   * Get file extension from MIME type
   */
  private getFileExtensionFromMimeType(mimeType: string, type: string = 'image'): string {
    if (type === 'image') {
      const extensionMap: Record<string, string> = {
        'image/jpeg': '.jpg',
        'image/jpg': '.jpg',
        'image/png': '.png',
        'image/gif': '.gif',
        'image/webp': '.webp',
        'image/svg+xml': '.svg',
      };
      return extensionMap[mimeType] || '.jpg';
    }
    
    if (type === 'document') {
      const extensionMap: Record<string, string> = {
        'application/pdf': '.pdf',
        'application/msword': '.doc',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
        'application/vnd.ms-excel': '.xls',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
        'text/plain': '.txt',
        'text/csv': '.csv',
      };
      return extensionMap[mimeType] || '.pdf';
    }

    return '.dat';
  }

  /**
   * Get MIME type from URI and type
   */
  private getMimeTypeFromUri(uri: string, type: string): string {
    // Handle content:// URIs on Android - these don't have extensions in the path
    if (uri.startsWith('content://')) {
      if (type === 'image') return 'image/jpeg';
      if (type === 'document') return 'application/pdf';
      return 'application/octet-stream';
    }

    const extension = uri.split('.').pop()?.toLowerCase();
    
    if (type === 'image') {
      switch (extension) {
        case 'png': return 'image/png';
        case 'gif': return 'image/gif';
        case 'webp': return 'image/webp';
        case 'svg': return 'image/svg+xml';
        default: return 'image/jpeg';
      }
    }
    
    if (type === 'document') {
      switch (extension) {
        case 'pdf': return 'application/pdf';
        case 'doc': return 'application/msword';
        case 'docx': return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        case 'xls': return 'application/vnd.ms-excel';
        case 'xlsx': return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        case 'txt': return 'text/plain';
        case 'csv': return 'text/csv';
        default: return 'application/octet-stream';
      }
    }
    
    return 'application/octet-stream';
  }

  /**
   * Generic file upload method
   */
  private async uploadFile<T>(
    endpoint: string,
    formData: FormData,
    options?: FileUploadOptions
  ): Promise<ApiResponse<T>> {
    try {
      return await this.upload<T>(endpoint, formData);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Validate file before upload
   */
  validateFile(
    fileUri: string, 
    type: 'image' | 'document' | 'any', 
    limits: FileUploadLimits
  ): { isValid: boolean; error?: string } {
    const mimeType = this.getMimeTypeFromUri(fileUri, type);
    const config = limits[type];
    
    // Check file type
    if (!config.allowedTypes.includes(mimeType)) {
      return {
        isValid: false,
        error: `File type ${mimeType} is not allowed`
      };
    }
    
    return { isValid: true };
  }

  /**
   * Format file size for display
   */
  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 KB';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  }
}

export const fileUploadService = new FileUploadService();
