import { MaterialIcons } from '@expo/vector-icons';
import { ScrollView, StyleSheet, TouchableOpacity, View, Platform, Dimensions } from 'react-native';
import { useRef, useState, useEffect } from 'react';
import { NetworkImage } from '@/components/ui/network-image';
import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';

interface ImageUploadSectionProps {
  images: string[];
  isUploading: boolean;
  errors: { [key: string]: string };
  onImagePicker: () => void;
  onRemoveImage: (index: number) => void;
  uploadedCount?: number;
  uploadProgress?: number;
  uploadError?: string | null;
  imageUploadStatus?: {
    index: number;
    status: 'uploading' | 'success' | 'error';
    progress?: number;
  }[];
  requiredImages?: number;
  maxImages?: number;
}

export function ImageUploadSection({
  images,
  isUploading,
  errors,
  onImagePicker,
  onRemoveImage,
  uploadedCount = 0,
  uploadProgress = 0,
  uploadError,
  imageUploadStatus = [],
  requiredImages = 2,
  maxImages = 8
}: ImageUploadSectionProps) {
  const scrollViewRef = useRef<ScrollView>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(true);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const isDesktop = Platform.OS === 'web';

  // On desktop, always show arrows since there are 8 upload slots
  useEffect(() => {
    if (isDesktop) {
      setCanScrollLeft(true);
      setCanScrollRight(true);
    }
  }, [isDesktop]);

  const checkScrollability = (event: any) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const maxOffset = contentSize.width - layoutMeasurement.width;

    setCanScrollLeft(contentOffset.x > 10);
    setCanScrollRight(contentOffset.x < maxOffset - 10);
  };

  const scrollLeft = () => {
    if (scrollViewRef.current) {
      scrollViewRef.current.scrollTo({ x: 0, animated: true });
    }
  };

  const scrollRight = () => {
    if (scrollViewRef.current) {
      scrollViewRef.current.scrollToEnd({ animated: true });
    }
  };

  const renderImageItem = (item: string | null, index: number) => {
    const imageStatus = imageUploadStatus?.find(status => status.index === index);
    
    if (item && index < images.length) {
      return (
        <View key={index} style={styles.imageContainer}>
          <NetworkImage
            source={{ uri: item }}
            style={styles.uploadedImage}
            contentFit="cover"
            resizeMode="cover"
            placeholder={require('@/assets/images/placeholder.png')}
          />
          
          {/* Upload Status Overlay */}
          {imageStatus?.status === 'uploading' && (
            <View style={styles.imageStatusOverlay}>
              <View style={styles.imageProgressBar}>
                <View style={[styles.imageProgressFill, { width: `${imageStatus.progress || 0}%` }]} />
              </View>
              <MaterialIcons name="cloud-upload" size={12} color="#FFFFFF" />
            </View>
          )}
          
          {imageStatus?.status === 'success' && (
            <View style={[styles.imageStatusOverlay, styles.successStatusOverlay]}>
              <MaterialIcons name="check" size={12} color="#FFFFFF" />
            </View>
          )}
          
          {imageStatus?.status === 'error' && (
            <View style={styles.imageErrorOverlay}>
              <MaterialIcons name="close" size={16} color="#FFFFFF" />
              <ThemedText style={styles.errorText}>Upload Failed</ThemedText>
            </View>
          )}
          
          <TouchableOpacity
            style={styles.removeImageButton}
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
          style={[
            styles.uploadButton,
            isUploading && styles.uploadButtonDisabled
          ]}
          onPress={index === images.length ? onImagePicker : undefined}
          disabled={isUploading}
        >
          <MaterialIcons 
            name="add-photo-alternate" 
            size={24} 
            color={isUploading ? Colors.light.textSecondary : Colors.light.primary} 
          />
          <ThemedText style={[
            styles.uploadText,
            isUploading && styles.uploadTextDisabled
          ]}>
            Photo {index + 1}
          </ThemedText>
        </TouchableOpacity>
      );
    }
  };

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View>
          <ThemedText style={styles.sectionTitle}>Upload Ad Photos</ThemedText>
          <ThemedText style={styles.infoText}>
            Your photos will be cover/thumbnail
          </ThemedText>
        </View>
      </View>

      <ThemedText style={styles.coverPhotoLabel}>Cover Photo</ThemedText>

      <View style={styles.imageScrollContainer}>
        {/* Left Arrow - Desktop only */}
        {isDesktop && canScrollLeft && (
          <TouchableOpacity
            style={styles.scrollArrowLeft}
            onPress={scrollLeft}
            activeOpacity={0.7}
          >
            <MaterialIcons name="chevron-left" size={32} color={Colors.light.primary} />
          </TouchableOpacity>
        )}

        <ScrollView
          ref={scrollViewRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.horizontalImageGrid}
          onScroll={isDesktop ? checkScrollability : undefined}
          scrollEventThrottle={100}
        >
          {[...images, ...Array(Math.max(maxImages - images.length, 0)).fill(null)].map((item, index) => renderImageItem(item, index))}
        </ScrollView>

        {/* Right Arrow - Desktop only */}
        {isDesktop && canScrollRight && (
          <TouchableOpacity
            style={styles.scrollArrowRight}
            onPress={scrollRight}
            activeOpacity={0.7}
          >
            <MaterialIcons name="chevron-right" size={32} color={Colors.light.primary} />
          </TouchableOpacity>
        )}
      </View>

      {errors.images && (
        <ThemedText style={styles.errorText}>{errors.images}</ThemedText>
      )}

      {!errors.images && (
        <ThemedText style={styles.infoText}>
          {requiredImages > 0 
            ? `Add at least ${requiredImages} photos to meet the minimum requirement`
            : "Photos are optional for this category, but recommended for better visibility"}
        </ThemedText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sectionHeader: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 13,
    color: '#666666',
    marginTop: 8,
    marginBottom: 4,
    lineHeight: 18,
  },
  coverPhotoLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333333',
    marginBottom: 12,
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 12,
    marginTop: 8,
    marginBottom: 4,
  },
  imageScrollContainer: {
    position: 'relative',
  },
  scrollArrowLeft: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    shadowColor: '#000',
    shadowOffset: { width: -2, height: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  scrollArrowRight: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  horizontalImageGrid: {
    flexDirection: 'row',
    paddingHorizontal: 4,
    paddingVertical: 8,
  },
  imageContainer: {
    width: 120,
    height: 120,
    marginHorizontal: 8,
    position: 'relative',
  },
  uploadedImage: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
    // Additional properties to ensure proper cover behavior on Android
    overflow: 'hidden',
  },
  removeImageButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FF3B30',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    zIndex: 2,
  },
  imageStatusOverlay: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    left: 4,
    height: 24,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 4,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  imageProgressBar: {
    width: '40%',
    height: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 2,
    overflow: 'hidden',
    marginRight: 6,
  },
  imageProgressFill: {
    height: '100%',
    backgroundColor: '#007AFF',
    borderRadius: 2,
  },
  successStatusOverlay: {
    backgroundColor: 'rgba(76, 175, 80, 0.9)',
  },
  imageErrorOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(244, 67, 54, 0.9)',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
    gap: 8,
  },
  coverBadge: {
    position: 'absolute',
    top: -8,
    left: -8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    zIndex: 2,
  },
  uploadButton: {
    width: 120,
    height: 120,
    backgroundColor: '#FAFAFA',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 8,
  },
  uploadButtonDisabled: {
    opacity: 0.6,
    backgroundColor: '#F0F0F0',
  },
  uploadText: {
    fontSize: 12,
    color: '#666666',
    textAlign: 'center',
    marginTop: 4,
  },
  uploadTextDisabled: {
    color: '#999999',
  },
});