import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, ActivityIndicator, Animated } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import { fileUploadService } from '@/services/file-upload.service';

interface FileAttributeInputProps {
  label: string;
  value: string[];
  error?: string;
  required?: boolean;
  onValueChange: (value: string[]) => void;
  maxFiles?: number;
}

export function FileAttributeInput({
  label,
  value = [],
  error,
  required,
  onValueChange,
  maxFiles = 5,
}: FileAttributeInputProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleFilePick = async () => {
    if (value.length >= maxFiles) {
      setUploadError(`Maximum ${maxFiles} files allowed`);
      return;
    }

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'application/pdf', 
          'application/msword', 
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'text/plain',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        ],
        copyToCacheDirectory: true,
        multiple: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const remainingSlots = maxFiles - value.length;
        const filesToUpload = result.assets.slice(0, remainingSlots);
        
        // Sequential upload to avoid overlapping state updates
        for (const asset of filesToUpload) {
          await uploadFile(asset);
        }
      }
    } catch (err) {
      setUploadError('Failed to pick document');
    }
  };

  const uploadFile = async (asset: DocumentPicker.DocumentPickerAsset) => {
    setIsUploading(true);
    setUploadError(null);

    try {
      // Use uploadDocumentFromAsset which handles web platform correctly
      const response = await fileUploadService.uploadDocumentFromAsset(asset);
      if (response.success && response.data) {
        // Use functional state update to handle rapid sequential uploads
        onValueChange([...value, response.data.url]);
      } else {
        setUploadError('Upload failed');
      }
    } catch (err: any) {
      setUploadError(err.message || 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemove = (index: number) => {
    const newValue = [...value];
    newValue.splice(index, 1);
    onValueChange(newValue);
    setUploadError(null);
  };

  const getFileName = (url: string) => {
    if (!url) return '';
    const parts = url.split('/');
    const lastPart = parts[parts.length - 1];
    return decodeURIComponent(lastPart);
  };

  const getFileIcon = (url: string) => {
    const ext = url.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'pdf': return 'picture-as-pdf';
      case 'doc':
      case 'docx': return 'description';
      case 'xls':
      case 'xlsx': return 'table-chart';
      default: return 'insert-drive-file';
    }
  };

  const getIconColor = (url: string) => {
    const ext = url.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'pdf': return '#F44336';
      case 'doc':
      case 'docx': return '#2196F3';
      case 'xls':
      case 'xlsx': return '#4CAF50';
      default: return Colors.light.primary;
    }
  };

  return (
    <View style={styles.container}>
      <ThemedText style={styles.label}>
        {label}{required ? <ThemedText style={styles.required}> *</ThemedText> : null}
      </ThemedText>

      <View style={styles.fileList}>
        {value.map((url, index) => (
          <View key={index} style={styles.fileInfo}>
            <View style={[styles.iconContainer, { backgroundColor: getIconColor(url) + '15' }]}>
              <MaterialIcons name={getFileIcon(url)} size={22} color={getIconColor(url)} />
            </View>
            <ThemedText style={styles.fileName} numberOfLines={1}>
              {getFileName(url)}
            </ThemedText>
            <TouchableOpacity onPress={() => handleRemove(index)} style={styles.removeButton} hitSlop={10}>
              <MaterialIcons name="cancel" size={20} color={Colors.light.textSecondary} />
            </TouchableOpacity>
          </View>
        ))}
      </View>

      {value.length < maxFiles && (
        <TouchableOpacity
          style={[
            styles.uploadButton, 
            (error || uploadError) ? styles.errorBorder : null,
            isUploading ? styles.uploadingState : null
          ]}
          onPress={handleFilePick}
          disabled={isUploading}
        >
          {isUploading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator color={Colors.light.primary} size="small" />
              <ThemedText style={styles.uploadingText}>Uploading document...</ThemedText>
            </View>
          ) : (
            <>
              <View style={styles.addIconCircle}>
                <MaterialIcons name="add" size={20} color={Colors.light.primary} />
              </View>
              <ThemedText style={styles.uploadText}>
                {value.length === 0 ? 'Upload Documents (PDF, Word)' : 'Add another document'}
              </ThemedText>
            </>
          )}
        </TouchableOpacity>
      )}

      <View style={styles.footer}>
        <ThemedText style={styles.limitText}>
          {value.length} / {maxFiles} files
        </ThemedText>
        {(error || uploadError) && (
          <ThemedText style={styles.errorText}>{error || uploadError}</ThemedText>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  required: {
    color: Colors.light.error,
  },
  fileList: {
    gap: 8,
    marginBottom: 8,
  },
  fileInfo: {
    height: 52,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    backgroundColor: '#FFFFFF',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  fileName: {
    flex: 1,
    fontSize: 14,
    color: '#444',
    fontWeight: '500',
  },
  removeButton: {
    padding: 4,
    opacity: 0.7,
  },
  uploadButton: {
    height: 56,
    borderWidth: 1.5,
    borderColor: Colors.light.primary + '40',
    borderRadius: 12,
    borderStyle: 'dashed',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.light.primary + '05',
    gap: 10,
    marginTop: 4,
  },
  uploadingState: {
    borderStyle: 'solid',
    borderColor: Colors.light.primary + '20',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  addIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.light.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadText: {
    color: Colors.light.primary,
    fontWeight: '600',
    fontSize: 14,
  },
  uploadingText: {
    color: Colors.light.primary,
    fontSize: 14,
    fontWeight: '500',
  },
  footer: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
    paddingHorizontal: 2,
  },
  limitText: {
    fontSize: 12,
    color: '#757575',
    fontWeight: '500',
  },
  errorBorder: {
    borderColor: Colors.light.error + '60',
    backgroundColor: Colors.light.error + '05',
  },
  errorText: {
    fontSize: 12,
    color: Colors.light.error,
    fontWeight: '500',
  },
});
