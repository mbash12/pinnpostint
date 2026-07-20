import { MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useEffect, useRef, useState, useCallback } from 'react';
import { ActivityIndicator, Animated, Dimensions, Platform, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useAlert } from '@/components/ui/custom-alert';
import { fileUploadService } from '@/services/file-upload.service';
import { categoriesService, type Attribute } from '@/services/categories.service';
import type { FileUploadResponse, FileUploadLimits } from '@/types/api.types';
import { adDataStorage } from '@/utils/ad-data-storage';
import { adValidationSchema, validateForm as validateFormWithSchema, validateFormField, validateAttributes, validateAttribute, getCharacterLimitStatus } from '@/utils/validation';
import { AdLocation } from '@/types/location.types';
import { ThemedText } from '@/components/themed-text';
import { FloatingLabelInput } from '@/components/ui/floating-label-input';
import { GradientButton } from '@/components/ui/gradient-button';
import { Footer } from '@/components/footer';
import { MobilePlatformBanners } from '@/components/mobile-platform-banners';

import { AuthProtection } from '@/components/auth-protection';
import { SideBanners } from '@/components/home/side-banners';
import { CustomDropdown } from '@/components/shared/custom-dropdown';
import { ImageUploadSection } from '@/components/ad-form/image-upload-section';
import { AttachmentSection } from '@/components/ad-form/attachment-section';
import { TitleDescriptionSection } from '@/components/ad-form/title-description-section';
import { PricingSection } from '@/components/ad-form/pricing-section';
import { BookingConfigSection } from '@/components/ad-form/booking-config-section';
import { LocationSection } from '@/components/ad-form/location-section';
import { AttributesSection } from '@/components/ad-form/attributes-section';
import { Colors } from '@/constants/theme';
import { platformAdsService } from '@/services';
import type { PlatformAd } from '@/types/api.types';
import { PlatformAdPosition } from '@/types/api.types';

interface AdFormData {
  title: string;
  description: string;
  price: string;
  discountedPrice: string;
  useDiscountedPrice: boolean;
  enableBooking: boolean;
  categoryId: string;
  subcategoryId: string;
  location?: AdLocation;
  attachment?: string[];
  bookingType: 'SLOTS';
  slots: any[];
}

interface FormErrors {
  [key: string]: string;
}

// Configuration
const REQUIRED_IMAGES = 2;
const MAX_IMAGES = 8;

const { width } = Dimensions.get('window');

export default function AdFormPage() {
  const { categoryId, subcategoryId, categoryPlaceholder } = useLocalSearchParams<{
    categoryId: string;
    subcategoryId: string;
    categoryPlaceholder?: string;
  }>();

  const { showAlert } = useAlert();

  const scrollViewRef = useRef<ScrollView>(null);
  const [showValidationError, setShowValidationError] = useState(false);
  const [validationErrorMessage, setValidationErrorMessage] = useState('');

  const [categoryName, setCategoryName] = useState('');
  const [subcategoryName, setSubcategoryName] = useState('');
  const [formData, setFormData] = useState<AdFormData>({
    title: '',
    description: '',
    price: '',
    discountedPrice: '',
    useDiscountedPrice: false,
    enableBooking: false,
    categoryId: categoryId || '',
    subcategoryId: subcategoryId || '',
    location: undefined,
    attachment: [],
    bookingType: 'SLOTS',
    slots: [],
  });

  const [images, setImages] = useState<string[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<FileUploadResponse[]>([]);
  const [uploadLimits, setUploadLimits] = useState<FileUploadLimits | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showLocationOptions, setShowLocationOptions] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [imageUploadStatus, setImageUploadStatus] = useState<{
    index: number;
    status: 'uploading' | 'success' | 'error';
    progress?: number;
  }[]>([]);
  const [attributes, setAttributes] = useState<Attribute[]>([]);
  const [attributeValues, setAttributeValues] = useState<Record<string, string>>({});
  const [attributeDropdowns, setAttributeDropdowns] = useState<Record<string, boolean>>({});
  const [locations, setLocations] = useState<any[]>([]); // Add locations state
  const scrollY = useRef(new Animated.Value(0)).current;
  const [screenWidth, setScreenWidth] = useState(Dimensions.get('window').width);
  const [platformAds, setPlatformAds] = useState<PlatformAd[]>([]);
  const [isLoadingForm, setIsLoadingForm] = useState(true);
  const [isLoadingPlatformAds, setIsLoadingPlatformAds] = useState(true);

  const isDesktop = Platform.OS === 'web' && screenWidth > 768;

  const normalizedCategoryName = categoryName?.toLowerCase() || '';
  const normalizedSubcategoryName = subcategoryName?.toLowerCase() || '';
  const isJobCategory = normalizedCategoryName.includes('job') || normalizedSubcategoryName.includes('job');
  const isServiceSubcategory =
    normalizedSubcategoryName.includes('service') &&
    normalizedCategoryName.includes('service');

  useEffect(() => {
    const fetchPlatformAds = async () => {
      try {
        setIsLoadingPlatformAds(true);
        const response = await platformAdsService.getPlatformAds();
        if (response.success && response.data) {
          setPlatformAds(response.data);
        }
      } catch (error) {
      } finally {
        setIsLoadingPlatformAds(false);
      }
    };
    fetchPlatformAds();
  }, []);

  useEffect(() => {
    const onChange = (result: any) => {
      setScreenWidth(result.window.width);
    };

    const dimensionsHandler = Platform.OS === 'web'
      ? Dimensions.addEventListener('change', onChange)
      : null;

    const initLoad = async () => {
      setIsLoadingForm(true);
      try {
        await Promise.all([
          loadUploadLimits(),
          subcategoryId ? loadAttributes() : Promise.resolve(),
        ]);
      } catch (error) {
      } finally {
        setIsLoadingForm(false);
      }
    };
    initLoad();

    return () => {
      if (dimensionsHandler) {
        dimensionsHandler.remove();
      }
    };
  }, [subcategoryId]);

  const loadStoredData = useCallback(async () => {
    try {
      const storedData = await adDataStorage.retrieve();
      
      // If there's stored data AND it's for the same subcategory, load it
      if (storedData && storedData.subcategoryId === subcategoryId) {
        setFormData({
          title: storedData.formData.title,
          description: storedData.formData.description,
          price: storedData.formData.price,
          discountedPrice: storedData.formData.discountedPrice,
          useDiscountedPrice: storedData.formData.useDiscountedPrice || false,
          enableBooking: storedData.formData.enableBooking,
          categoryId: categoryId || '',
          subcategoryId: subcategoryId || '',
          location: storedData.formData.location,
          attachment: storedData.formData.attachment || [],
          bookingType: 'SLOTS',
          slots: storedData.formData.slots || [],
        });
        setImages(storedData.images || []);
        setUploadedFiles(storedData.uploadedFiles || []);
        setAttributeValues(storedData.attributeValues || {});

        // Clear validation errors when loading stored data
        setErrors({});
        setShowValidationError(false);
      } else {
        // If no stored data or it's for a different subcategory, reset the form
        // This is crucial for when the user navigates back and selects a different subcategory
        setFormData({
          title: '',
          description: '',
          price: '',
          discountedPrice: '',
          useDiscountedPrice: false,
          enableBooking: false,
          categoryId: categoryId || '',
          subcategoryId: subcategoryId || '',
          location: undefined,
          attachment: [],
          bookingType: 'SLOTS',
          slots: [],
        });
        setImages([]);
        setUploadedFiles([]);
        setAttributeValues({});
        setErrors({});
        setShowValidationError(false);
        
        // If it was a different subcategory, clear the storage to be safe
        if (storedData) {
          await adDataStorage.clear();
        }
      }
    } catch (error) {
    }
  }, [subcategoryId, categoryId]);

  // Reload stored data when page gains focus (when coming back from preview)
  useFocusEffect(
    useCallback(() => {
      loadStoredData();
    }, [loadStoredData])
  );

  const loadUploadLimits = async () => {
    try {
      const response = await fileUploadService.getUploadLimits();
      if (response.success && response.data) {
        setUploadLimits(response.data);
      }
    } catch (error) {
    }
  };

  const loadAttributes = async () => {
    try {
      const response = await categoriesService.getSubcategoryAttributes(subcategoryId);
      if (response.success && response.data) {
        setAttributes(response.data);
      }

      const subResponse = await categoriesService.getCategorySubcategories(categoryId);
      if (subResponse.success && subResponse.data) {
        const subcategory = subResponse.data.find(s => s.id === subcategoryId);
        if (subcategory) setSubcategoryName(subcategory.name);
      }

      const catResponse = await categoriesService.getCategories();
      if (catResponse.success && catResponse.data) {
        const category = catResponse.data.find(c => c.id === categoryId);
        if (category) setCategoryName(category.name);
      }
    } catch (error) {
    }
  };

  const handleInputChange = (field: string, value: string | boolean | AdLocation) => {
    const prevFormData = { ...formData };
    setFormData(prev => ({
      ...prev,
      [field as keyof AdFormData]: value as any
    }));

    // Hide error block when user makes changes
    if (showValidationError) {
      setShowValidationError(false);
    }

    // Real-time validation for the changed field
    if (typeof value === 'string' && adValidationSchema[field]) {
      const error = validateFormField(
        field,
        value,
        adValidationSchema,
        { ...prevFormData, [field]: value }
      );
      setErrors(prev => ({
        ...prev,
        [field]: error || ''
      }));
    } else if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }

    // When useDiscountedPrice is toggled, validate the discountedPrice field
    if (field === 'useDiscountedPrice') {
      const updatedFormData = { ...prevFormData, useDiscountedPrice: value as boolean };
      const discountError = validateFormField(
        'discountedPrice',
        updatedFormData.discountedPrice || '',
        adValidationSchema,
        updatedFormData
      );
      setErrors(prev => ({
        ...prev,
        discountedPrice: discountError || ''
      }));
    }
  };

  const handleImagePicker = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (status !== 'granted') {
      showAlert({
        title: 'Permission needed',
        message: 'Please grant camera roll permissions to upload images',
        type: 'warning'
      });
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsMultipleSelection: true,
    });

    if (!result.canceled && result.assets) {
      const newImages = result.assets.map((asset: any) => asset.uri);
      setImages(prev => [...prev, ...newImages].slice(0, MAX_IMAGES - 1));

      if (uploadLimits && result.assets.length > 0) {
        await handleUploadImages(result.assets);
      }
    }
  };

  const handleUploadImages = async (assets: ImagePicker.ImagePickerAsset[]) => {
    if (!uploadLimits) return;

    setIsUploading(true);
    setUploadError(null);

    // Initialize upload status for each new image
    const newImageStatuses = assets.map((asset, index) => ({
      index: images.length + index,
      status: 'uploading' as const,
      progress: 0
    }));

    setImageUploadStatus(prev => [...prev, ...newImageStatuses]);

    try {
      for (const asset of assets) {
        const validation = fileUploadService.validateFile(asset.uri, 'image', uploadLimits);
        if (!validation.isValid) {
          return;
        }
      }

      // Simulate individual image upload progress
      newImageStatuses.forEach((status, arrayIndex) => {
        const actualIndex = status.index;

        const progressInterval = setInterval(() => {
          setImageUploadStatus(prev =>
            prev.map(s =>
              s.index === actualIndex && s.status === 'uploading'
                ? { ...s, progress: Math.min((s.progress || 0) + 20, 100) }
                : s
            )
          );

          // Update overall upload progress only for uploading and successful items
          setImageUploadStatus(prev => {
            const allStatus = prev;
            const completedUploads = allStatus.filter(s => s.status === 'success').length;
            const totalUploads = allStatus.length;
            if (totalUploads > 0) {
              setUploadProgress((completedUploads / totalUploads) * 100);
            }
            return prev;
          });
        }, 300);

        // Complete after 1.5 seconds only if still uploading (not failed)
        setTimeout(() => {
          clearInterval(progressInterval);
          setImageUploadStatus(prev => {
            const currentStatus = prev.find(s => s.index === actualIndex);
            // Only mark as success if still uploading (not already failed)
            if (currentStatus && currentStatus.status === 'uploading') {
              const updated = prev.map(s =>
                s.index === actualIndex
                  ? { ...s, status: 'success' as const, progress: 100 }
                  : s
              );

              // Update overall upload progress
              const completedUploads = updated.filter(s => s.status === 'success').length;
              const totalUploads = updated.length;
              if (totalUploads > 0) {
                setUploadProgress((completedUploads / totalUploads) * 100);
              }

              return updated;
            }
            return prev;
          });
        }, 1500 + (arrayIndex * 200)); // Stagger the completions
      });

      const response = await fileUploadService.uploadImagesFromAssets(assets, {
        onProgress: (progress) => {
          setUploadProgress(progress);
        }
      });

      if (response.success && response.data) {
        const files = response.data.files;
        setUploadedFiles(prev => [...prev, ...files]);
      }
    } catch (error: any) {
      setUploadError(error.message || 'Upload failed');

      // Mark all pending uploads as error
      setImageUploadStatus(prev =>
        prev.map(status =>
          status.status === 'uploading'
            ? { ...status, status: 'error' as const }
            : status
        )
      );
    } finally {
      setIsUploading(false);
      setUploadProgress(100);

      // Clear error after 3 seconds
      if (uploadError) {
        setTimeout(() => setUploadError(null), 3000);
      }
    }
  };

  const removeImage = (index: number) => {
    const removedImage = images[index];
    setImages(prev => prev.filter((_, i) => i !== index));

    // Remove upload status for this image
    setImageUploadStatus(prev => prev.filter(status => status.index !== index));

    // Update indices of remaining upload statuses
    setImageUploadStatus(prev =>
      prev.map(status => ({
        ...status,
        index: status.index > index ? status.index - 1 : status.index
      }))
    );

    // Extract UUID from blob URL (format: blob:http://localhost:8081/uuid-hyphenated)
    // and match with filename (format: uuid_underscores-timestamp.jpg)
    let extractedId: string | null = null;
    if (removedImage.includes('blob:')) {
      const urlParts = removedImage.split('/');
      const lastPart = urlParts[urlParts.length - 1];
      extractedId = lastPart; // This is the UUID like "91bb3d78-c95b-4b9e-9940-c3617240ebc5"
    }

    const uploadedFileIndex = uploadedFiles.findIndex(file => {
      if (!extractedId) return false;

      // Convert UUID format from hyphens to underscores for comparison
      // UUID: 91bb3d78-c95b-4b9e-9940-c3617240ebc5
      // Filename: 91bb3d78_c95b_4b9e_9940_c3617240ebc5-1771908665153-309394393.jpg
      const idWithUnderscores = extractedId.replace(/-/g, '_');
      return file.filename.includes(idWithUnderscores);
    });

    if (uploadedFileIndex !== -1) {
      const fileToDelete = uploadedFiles[uploadedFileIndex];
      setUploadedFiles(prev => prev.filter((_, i) => i !== uploadedFileIndex));

      fileUploadService.deleteFile(fileToDelete.path).catch(error => {
      });
    }

    // Reset upload progress if no more uploads
    if (imageUploadStatus.length <= 1) {
      setUploadProgress(0);
    }
  };

  const handleToggleDropdown = (dropdown: string) => {
    if (dropdown.startsWith('attr_')) {
      const attrId = dropdown.replace('attr_', '');
      setAttributeDropdowns(prev => ({ ...prev, [attrId]: !prev[attrId] }));
      return;
    }

    switch (dropdown) {
      case 'showLocationOptions':
        setShowLocationOptions(!showLocationOptions);
        break;
    }
  };

  const validateForm = (): { isValid: boolean; errors: FormErrors } => {
    const newErrors: FormErrors = {};

    // EXPLICITLY validate location first
    if (!formData.location) {
      newErrors.location = 'Location is required';
    } else if (!formData.location.latitude || !formData.location.longitude) {
      newErrors.location = 'Please select a valid location';
    }

    // Validate discounted price first (when enabled) with full context
    if (formData.useDiscountedPrice) {
      const discountError = validateFormField(
        'discountedPrice',
        formData.discountedPrice,
        adValidationSchema,
        formData
      );
      if (discountError) {
        newErrors.discountedPrice = discountError;
      }
    }

    // Validate basic form fields using schema
    const formValidationErrors = validateFormWithSchema(
      {
        title: formData.title,
        description: formData.description,
        // Only include price for validation if not job/service category
        price: (isJobCategory || isServiceSubcategory) ? '1' : formData.price,
        discountedPrice: formData.useDiscountedPrice ? formData.discountedPrice : '',
        useDiscountedPrice: formData.useDiscountedPrice, // Include this for validation
        location: formData.location,
        categoryId: formData.categoryId,
      },
      adValidationSchema
    );

    // Only add discountedPrice error from schema if not already set
    // Also only add location error from schema if not already set above
    Object.entries(formValidationErrors).forEach(([key, value]) => {
      if (key === 'location' && newErrors.location) {
        // Skip, we already have a location error
        return;
      }
      if (key !== 'discountedPrice' || !newErrors.discountedPrice) {
        newErrors[key] = value;
      }
    });

    // Validate images - not required for job categories and Services
    const totalImages = Math.max(images.length, uploadedFiles.length);
    const requiredImagesCount = (isJobCategory || isServiceSubcategory) ? 0 : REQUIRED_IMAGES;
    
    if (totalImages < requiredImagesCount) {
      const remainingImages = requiredImagesCount - totalImages;
      newErrors.images = `Minimum ${requiredImagesCount} images required. Please add ${remainingImages} more photo${remainingImages > 1 ? 's' : ''}.`;
    }

    // Services can be posted without a price

    // Validate slots if booking is enabled
    if (formData.enableBooking && formData.slots.length === 0) {
      newErrors.slots = 'At least one time slot is required for booking';
    }

    // Validate attributes using the enhanced validation
    const attributeErrors = validateAttributes(attributeValues, attributes);
    Object.assign(newErrors, attributeErrors);

    setErrors(newErrors);
    return { isValid: Object.keys(newErrors).length === 0, errors: newErrors };
  };

  const handleSubmit = async () => {
    const validationResult = validateForm();

    if (!validationResult.isValid) {
      // Show detailed error block first - order errors as they appear in the form
      const orderedErrors: string[] = [];
      const processedKeys = new Set<string>();

      // Helper to add error if exists and track the key
      const addError = (key: string) => {
        if (validationResult.errors[key] && !processedKeys.has(key)) {
          orderedErrors.push(validationResult.errors[key]);
          processedKeys.add(key);
        }
      };

      // Order: Images, Title, Description, Attributes, Price, DiscountedPrice, Location
      addError('images');
      addError('title');
      addError('description');

      // Add all attribute errors (they come after description, before price)
      Object.keys(validationResult.errors)
        .filter(key => key.startsWith('attr_'))
        .sort() // sort attributes alphabetically for consistency
        .forEach(key => addError(key));

      addError('price');
      addError('discountedPrice');
      addError('slots');
      addError('location');

      const errorMessage = orderedErrors.length > 0
        ? `• ${orderedErrors.join('\n• ')}`
        : 'Please fix the errors in the form';

      setValidationErrorMessage(errorMessage);
      setShowValidationError(true);

      // Show simple popup - scroll to top when button is pressed
      showAlert({
        title: 'Validation Error',
        message: 'Please fix the errors in the form',
        type: 'error',
        buttons: [
          {
            text: 'Try Again',
            onPress: () => {
              // Scroll to top after popup is dismissed
              setTimeout(() => {
                scrollViewRef.current?.scrollTo({ y: 0, animated: true });
              }, 300);
            }
          }
        ]
      });

      return;
    }

    // Store form data and navigate to preview
    const adData = {
      formData,
      images,
      uploadedFiles,
      categoryName,
      subcategoryName,
      categoryPlaceholder,
      categoryId,
      subcategoryId,
      attributeValues,
    };

    try {
      // Store data in AsyncStorage instead of URL params
      await adDataStorage.store(adData);

      // Navigate to preview with timestamp to force remount
      router.push({
        pathname: '/(pages)/create-ad/preview',
        params: { t: Date.now().toString() }
      });
    } catch (error) {
      showAlert({
        title: 'Error',
        message: 'Failed to prepare preview. Please try again.',
        type: 'error'
      });
    }
  };

  if (isDesktop) {
    return (
      <AuthProtection>
          {isLoadingForm ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={Colors.light.primary} />
            </View>
          ) : (
          <ScrollView
            ref={scrollViewRef}
            style={desktopStyles.container}
            contentContainerStyle={desktopStyles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={desktopStyles.desktopHeader}>
              <ThemedText style={desktopStyles.desktopTitle}>Post Your Ad</ThemedText>
              <View style={desktopStyles.subtitleContainer}>
                <ThemedText style={desktopStyles.desktopSubtitle}>{categoryName}</ThemedText>
                {subcategoryName ? (
                  <>
                    <MaterialIcons name="chevron-right" size={14} color={Colors.light.textSecondary} />
                    <ThemedText style={desktopStyles.desktopSubtitle}>{subcategoryName}</ThemedText>
                  </>
                ) : null}
              </View>            </View>

            {!isDesktop && <MobilePlatformBanners ads={platformAds} position="top" style={{ marginVertical: 8, paddingHorizontal: 16 }} />}

            <View style={desktopStyles.desktopHomeWrapper}>
              {isDesktop && (
                <SideBanners
                  ads={platformAds.filter(ad => ad.position === PlatformAdPosition.LEFT)}
                  position={PlatformAdPosition.LEFT}
                />
              )}

              <View style={desktopStyles.desktopMainContent}>
                <View style={desktopStyles.contentWrapper}>
              {showValidationError && (
                <View style={desktopStyles.errorBlock}>
                  <View style={desktopStyles.errorBlockHeader}>
                    <MaterialIcons name="error-outline" size={20} color="#D32F2F" />
                    <ThemedText style={desktopStyles.errorBlockTitle}>Please Fix the Following Issues</ThemedText>
                  </View>
                  <ThemedText style={desktopStyles.errorText}>{validationErrorMessage}</ThemedText>
                </View>
              )}
              {!(subcategoryName === 'Job Vacancies' || subcategoryName === 'Post Resume' || subcategoryName === 'Looking for Work' || isServiceSubcategory) && (
                <ImageUploadSection
                  images={images}
                  isUploading={isUploading}
                  errors={errors}
                  onImagePicker={handleImagePicker}
                  onRemoveImage={removeImage}
                  uploadedCount={uploadedFiles.length}
                  uploadProgress={isUploading ? uploadProgress : 0}
                  uploadError={uploadError}
                  imageUploadStatus={imageUploadStatus}
                  requiredImages={(categoryName?.toLowerCase().includes('job') || subcategoryName?.toLowerCase().includes('job')) ? 0 : REQUIRED_IMAGES}
                  maxImages={MAX_IMAGES}
                />
              )}
              <View style={desktopStyles.formContentWrapper}>
                <TitleDescriptionSection
                  formData={formData}
                  errors={errors}
                  onInputChange={handleInputChange}
                />
                {categoryName === 'Services & Jobs' && (
                  <AttachmentSection
                    attachment={formData.attachment || []}
                    onAttachmentChange={(value) => handleInputChange('attachment', value)}
                    error={errors.attachment}
                  />
                )}
                <AttributesSection
                  attributes={attributes}
                  values={attributeValues}
                  errors={errors}
                  dropdownStates={attributeDropdowns}
                  onValueChange={(attrId, value) => {
                    setAttributeValues(prev => ({ ...prev, [attrId]: value }));

                    // Real-time validation for attributes
                    const attr = attributes.find(a => a.id === attrId);
                    if (attr) {
                      const error = validateAttribute(value, attr);
                      setErrors(prev => ({
                        ...prev,
                        [`attr_${attrId}`]: error || ''
                      }));
                    }
                  }}
                  onToggleDropdown={handleToggleDropdown}
                />
                {!isJobCategory && !isServiceSubcategory && (
                  <PricingSection
                    formData={formData}
                    errors={errors}
                    onInputChange={handleInputChange}
                    showDiscount={!isJobCategory && !isServiceSubcategory}
                priceRequired={!isServiceSubcategory}
                  />
                )}
                <BookingConfigSection
                  formData={formData}
                  onInputChange={handleInputChange}
                  categoryName={categoryName}
                  isEditing={false}
                />
                <LocationSection
                  formData={formData}
                  errors={errors}
                  onInputChange={(field, value) => handleInputChange(field, value as any)}
                />

                <View style={desktopStyles.submitContainer}>
                  <GradientButton
                    title={isSubmitting ? 'Creating...' : 'Continue'}
                    onPress={handleSubmit}
                    loading={isSubmitting}
                    disabled={isSubmitting}
                    style={desktopStyles.submitButton}
                  />
                </View>
              </View>
            </View>
          </View>

              {isDesktop && (
                <SideBanners
                  ads={platformAds.filter(ad => ad.position === PlatformAdPosition.RIGHT)}
                  position={PlatformAdPosition.RIGHT}
                />
              )}
            </View>

            {!isDesktop && <MobilePlatformBanners ads={platformAds} position="bottom" style={{ marginTop: 4, marginBottom: 24, paddingHorizontal: 16 }} />}
            <Footer />
          </ScrollView>
          )}
      </AuthProtection>
    );
  }

  return (
    <AuthProtection>
          {isLoadingForm ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={Colors.light.primary} />
            </View>
          ) : (
          <Animated.ScrollView
            ref={scrollViewRef}
          style={styles.container}
          showsVerticalScrollIndicator={false}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: false }
          )}
          scrollEventThrottle={16}
        >
          <View style={styles.header}>
            <ThemedText style={styles.title}>Post Your Ad</ThemedText>
            <View style={styles.subtitleRow}>
              <ThemedText style={styles.subtitle}>{categoryName}</ThemedText>
              {subcategoryName ? (
                <>
                  <MaterialIcons name="chevron-right" size={14} color={Colors.light.textSecondary} />
                  <ThemedText style={styles.subtitle}>{subcategoryName}</ThemedText>
                </>
              ) : null}
            </View>
          </View>

          <MobilePlatformBanners ads={platformAds} position="top" style={{ marginVertical: 8, paddingHorizontal: 16 }} />

          {showValidationError && (
            <View style={styles.errorBlock}>
              <View style={styles.errorBlockHeader}>
                <MaterialIcons name="error-outline" size={20} color="#D32F2F" />
                <ThemedText style={styles.errorBlockTitle}>Please Fix the Following Issues</ThemedText>
              </View>
              <ThemedText style={styles.errorText}>{validationErrorMessage}</ThemedText>
            </View>
          )}

          {!(subcategoryName === 'Job Vacancies' || subcategoryName === 'Post Resume' || subcategoryName === 'Looking for Work' || isServiceSubcategory) && (
            <ImageUploadSection
              images={images}
              isUploading={isUploading}
              errors={errors}
              onImagePicker={handleImagePicker}
              onRemoveImage={removeImage}
              uploadedCount={uploadedFiles.length}
              uploadProgress={isUploading ? uploadProgress : 0}
              uploadError={uploadError}
              imageUploadStatus={imageUploadStatus}
              requiredImages={(categoryName?.toLowerCase().includes('job') || subcategoryName?.toLowerCase().includes('job')) ? 0 : REQUIRED_IMAGES}
              maxImages={MAX_IMAGES}
            />
          )}
          <TitleDescriptionSection
            formData={formData}
            errors={errors}
            onInputChange={handleInputChange}
          />
          {categoryName === 'Services & Jobs' && (
            <AttachmentSection
              attachment={formData.attachment || []}
              onAttachmentChange={(value) => handleInputChange('attachment', value)}
              error={errors.attachment}
            />
          )}
          <AttributesSection
            attributes={attributes}
            values={attributeValues}
            errors={errors}
            dropdownStates={attributeDropdowns}
            onValueChange={(attrId, value) => {
              setAttributeValues(prev => ({ ...prev, [attrId]: value }));

              // Real-time validation for attributes
              const attr = attributes.find(a => a.id === attrId);
              if (attr) {
                const error = validateAttribute(value, attr);
                setErrors(prev => ({
                  ...prev,
                  [`attr_${attrId}`]: error || ''
                }));
              }
            }}
            onToggleDropdown={handleToggleDropdown}
          />
          {!isJobCategory && !isServiceSubcategory && (
            <PricingSection
              formData={formData}
              errors={errors}
              onInputChange={handleInputChange}
              showDiscount={!isJobCategory && !isServiceSubcategory}
              priceRequired={!isServiceSubcategory}
            />
          )}
          <BookingConfigSection
            formData={formData}
            onInputChange={handleInputChange}
            categoryName={categoryName}
            isEditing={false}
          />
          <LocationSection
            formData={formData}
            errors={errors}
            onInputChange={(field, value) => handleInputChange(field, value as any)}
          />

          <View style={styles.submitContainer}>
            <GradientButton
              title={isSubmitting ? 'Creating...' : 'Continue'}
              onPress={handleSubmit}
              loading={isSubmitting}
              disabled={isSubmitting}
              style={styles.submitButton}
            />
          </View>

          <MobilePlatformBanners ads={platformAds} position="bottom" style={{ marginTop: 4, marginBottom: 24, paddingHorizontal: 16 }} />
          <Footer />
        </Animated.ScrollView>
      )}
    </AuthProtection>
  );
}

// Desktop Styles
const desktopStyles = StyleSheet.create<any>({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  desktopHomeWrapper: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-start',
    width: '100%',
    alignSelf: 'center',
    position: 'relative',
  },
  desktopMainContent: {
    width: '100%',
    maxWidth: 1000,
    position: 'relative',
  },
  desktopHeader: {
    paddingHorizontal: 40,
    paddingTop: 40,
    paddingBottom: 20,
    alignItems: 'center',
  },
  desktopTitle: {
    fontSize: 36,
    fontWeight: '800',
    color: '#000000',
    marginBottom: 8,
  },
  desktopSubtitle: {
    fontSize: 16,
    color: '#666',
  },
  subtitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  scrollContent: {
    flexGrow: 1,
  },
  contentWrapper: {
    width: '100%',
    maxWidth: 1000,
    marginHorizontal: 'auto',
    paddingHorizontal: 40,
    paddingBottom: 40,
  },
  errorBlock: {
    backgroundColor: '#FFEBEE',
    borderLeftWidth: 4,
    borderLeftColor: '#D32F2F',
    padding: 16,
    marginBottom: 20,
    borderRadius: 8,
  },
  errorBlockHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  errorBlockTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#D32F2F',
    marginLeft: 8,
  },
  errorText: {
    fontSize: 14,
    color: '#D32F2F',
    lineHeight: 20,
    marginLeft: 28,
  },
  submitContainer: {
    marginTop: 40,
    marginBottom: 40,
  },
  submitButton: {
    height: 56,
  },
  formContentWrapper: {
    minWidth: '100%',
    width: '100%',
    alignSelf: 'center',
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 95,
    paddingBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.light.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.light.textSecondary,
    lineHeight: 22,
  },
  subtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  errorBlock: {
    backgroundColor: '#FFEBEE',
    borderLeftWidth: 4,
    borderLeftColor: '#D32F2F',
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 8,
  },
  errorBlockHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  errorBlockTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#D32F2F',
    marginLeft: 8,
  },
  errorText: {
    fontSize: 14,
    color: '#D32F2F',
    lineHeight: 20,
    marginLeft: 28,
  },
  submitContainer: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  submitButton: {
    marginBottom: 20,
  },
  formContentWrapper: {
    minWidth: '100%',
    width: '100%',
    alignSelf: 'center',
  },
});
