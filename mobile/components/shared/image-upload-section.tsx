import { MaterialIcons } from '@expo/vector-icons';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { NetworkImage } from '@/components/ui/network-image';
import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import { fileUploadService } from '@/services/file-upload.service';
import type { FileUploadResponse, FileUploadLimits } from '@/types/api.types';
import { useState, useEffect } from 'react';
import { useAlert } from '@/components/ui/custom-alert';

interface ImageUploadSectionProps {
  images: string[];
  onAddImage: () => void;
  onRemoveImage: (index: number) => void;
  onUploadComplete?: (uploadedFiles: FileUploadResponse[]) => void;
  error?: string;
  maxImages?: number;
  minImages?: number;
  enableUpload?: boolean;
}

export function ImageUploadSection({
  images,
  onAddImage,
  onRemoveImage,
  onUploadComplete,
  error,
  maxImages = 19,
  minImages = 8,
  enableUpload = false,
}: ImageUploadSectionProps) {
  const [uploadLimits, setUploadLimits] = useState<FileUploadLimits | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const { showAlert } = useAlert();

  const remainingSlots = maxImages - images.length;
  const allSlots = [...images, ...Array(Math.max(remainingSlots, 0)).fill(null)];

  // Load upload limits on component mount
  useEffect(() => {
    if (enableUpload) {
      loadUploadLimits();
    }
  }, [enableUpload]);

  const loadUploadLimits = async () => {
    try {
      const response = await fileUploadService.getUploadLimits();
      if (response.success && response.data) {
        setUploadLimits(response.data);
      }
    } catch (error) {
    }
  };

  const handleUploadImages = async (imageUris: string[]) => {
    if (!enableUpload || !uploadLimits) {
      return;
    }

    setIsUploading(true);
    const uploadedFiles: FileUploadResponse[] = [];

    try {
      // Validate files before upload
      for (const uri of imageUris) {
        const validation = fileUploadService.validateFile(uri, 'image', uploadLimits);
        if (!validation.isValid) {
          showAlert({
            title: 'Upload Error',
            message: validation.error || 'Invalid file',
            type: 'error'
          });
          return;
        }
      }

      // Upload files
      const response = await fileUploadService.uploadMultipleImages(imageUris, {
        onProgress: (progress) => {
          // Update progress for all files (simplified)
          const progressMap: Record<string, number> = {};
          imageUris.forEach(uri => {
            progressMap[uri] = progress;
          });
          setUploadProgress(progressMap);
        }
      });

      if (response.success && response.data) {
        uploadedFiles.push(...response.data.files);
        onUploadComplete?.(uploadedFiles);
      }
    } catch (error: any) {
      showAlert({
        title: 'Upload Failed',
        message: error.message || 'Failed to upload images',
        type: 'error'
      });
    } finally {
      setIsUploading(false);
      setUploadProgress({});
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <ThemedText style={styles.title}>Upload Ad Photos</ThemedText>
          <ThemedText style={styles.infoText}>
            Your photos will be the cover/thumbnail
          </ThemedText>
        </View>
      </View>
      
      <ThemedText style={styles.coverLabel}>Cover Photo</ThemedText>
      
      {error && (
        <ThemedText style={styles.errorText}>{error}</ThemedText>
      )}
      
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {allSlots.map((item, index) => {
          if (item && index < images.length) {
            return (
              <View key={index} style={styles.imageContainer}>
                <NetworkImage
                  source={{ uri: item }}
                  style={styles.uploadedImage}
                  placeholder={require('@/assets/images/placeholder.png')}
                />
                <TouchableOpacity
                  style={styles.removeButton}
                  onPress={() => onRemoveImage(index)}
                >
                  <MaterialIcons name="close" size={14} color="#FFFFFF" />
                </TouchableOpacity>
                {index === 0 && (
                  <View style={styles.coverBadge}>
                    <MaterialIcons name="star" size={12} color="#FFFFFF" />
                  </View>
                )}
              </View>
            );
          } else {
            return (
              <TouchableOpacity
                key={index}
                style={styles.uploadButton}
                onPress={index === images.length ? onAddImage : undefined}
                disabled={index !== images.length}
              >
                <MaterialIcons 
                  name="add-photo-alternate" 
                  size={24} 
                  color={index === images.length ? Colors.light.textSecondary : '#E5E5E5'} 
                />
                <ThemedText style={[
                  styles.uploadText,
                  index !== images.length && styles.uploadTextDisabled
                ]}>
                  Photo {index + 1}
                </ThemedText>
              </TouchableOpacity>
            );
          }
        })}
      </ScrollView>
      
      <ThemedText style={styles.requiredText}>
        {images.length < minImages 
          ? `Required: ${minImages - images.length} more photo${minImages - images.length > 1 ? 's' : ''}`
          : `${images.length} / ${maxImages} photos uploaded`
        }
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 24,
  },
  header: {
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 4,
  },
  infoText: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    lineHeight: 18,
  },
  coverLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 12,
  },
  errorText: {
    fontSize: 12,
    color: Colors.light.darkAccent,
    marginBottom: 8,
  },
  scrollContent: {
    paddingRight: 20,
  },
  imageContainer: {
    width: 100,
    height: 100,
    marginRight: 12,
    position: 'relative',
  },
  uploadedImage: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
  },
  removeButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  coverBadge: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    backgroundColor: Colors.light.primary,
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadButton: {
    width: 100,
    height: 100,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E5E5E5',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    backgroundColor: '#FAFAFA',
  },
  uploadText: {
    fontSize: 11,
    color: Colors.light.textSecondary,
    marginTop: 4,
    fontWeight: '500',
  },
  uploadTextDisabled: {
    color: '#E5E5E5',
  },
  requiredText: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    marginTop: 12,
    fontWeight: '500',
  },
});
