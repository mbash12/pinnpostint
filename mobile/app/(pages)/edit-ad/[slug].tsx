import { MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Dimensions, Platform, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useAlert } from '@/components/ui/custom-alert';
import { fileUploadService } from '@/services/file-upload.service';
import { categoriesService, type Attribute } from '@/services/categories.service';
import { locationsService, type Location } from '@/services/locations.service';
import { adsService } from '@/services';
import type { FileUploadResponse, FileUploadLimits, Ad } from '@/types/api.types';
import { adValidationSchema, validateForm as validateFormWithSchema, validateFormField, validateAttributes, validateAttribute } from '@/utils/validation';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { GradientButton } from '@/components/ui/gradient-button';
import { Footer } from '@/components/footer';
import { MobilePlatformBanners } from '@/components/mobile-platform-banners';

import { AuthProtection } from '@/components/auth-protection';
import { SideBanners } from '@/components/home/side-banners';
import { ImageUploadSection } from '@/components/ad-form/image-upload-section';
import { AttachmentSection } from '@/components/ad-form/attachment-section';
import { TitleDescriptionSection } from '@/components/ad-form/title-description-section';
import { PricingSection } from '@/components/ad-form/pricing-section';
import { BookingConfigSection } from '@/components/ad-form/booking-config-section';
import { LocationSection } from '@/components/ad-form/location-section';
import { AttributesSection } from '@/components/ad-form/attributes-section';
import { Colors } from '@/constants/theme';
import { AdNotFound404 } from '@/components/ui/ad-not-found-404';
import { AdLocation } from '@/types/location.types';
import { useBackNavigation, FALLBACK_ROUTES } from '@/utils/navigation-helpers';
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
  location?: AdLocation;
  attachment?: string[];
  bookingType: 'SLOTS';
  slots: any[];
}

interface FormErrors {
  [key: string]: string;
}

const REQUIRED_IMAGES = 2;
const MAX_IMAGES = 8;

export default function EditAdPage() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { showAlert } = useAlert();
  const { goBack } = useBackNavigation(FALLBACK_ROUTES.EDIT_AD);

  const scrollViewRef = useRef<ScrollView>(null);
  const [showValidationError, setShowValidationError] = useState(false);
  const [validationErrorMessage, setValidationErrorMessage] = useState('');

  const [ad, setAd] = useState<Ad | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [categoryName, setCategoryName] = useState('');
  const [subcategoryName, setSubcategoryName] = useState('');
  const [formData, setFormData] = useState<AdFormData>({
    title: '',
    description: '',
    price: '',
    discountedPrice: '',
    useDiscountedPrice: false,
    enableBooking: false,
    categoryId: '',
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
  const [showAdTypeOptions, setShowAdTypeOptions] = useState(false);
  const [showLocationOptions, setShowLocationOptions] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [imageUploadStatus, setImageUploadStatus] = useState<{ index: number; status: 'uploading' | 'success' | 'error'; progress?: number }[]>([]);
  const [attributes, setAttributes] = useState<Attribute[]>([]);
  const [attributeValues, setAttributeValues] = useState<Record<string, string>>({});
  const [attributeDropdowns, setAttributeDropdowns] = useState<Record<string, boolean>>({});
  const [locations, setLocations] = useState<Location[]>([]);
  const [screenWidth, setScreenWidth] = useState(Dimensions.get('window').width);
  const [platformAds, setPlatformAds] = useState<PlatformAd[]>([]);
  const [isLoadingPlatformAds, setIsLoadingPlatformAds] = useState(true);

  const isDesktop = Platform.OS === 'web' && screenWidth > 768;

  const isJobCategory = categoryName?.toLowerCase().includes('job') || subcategoryName?.toLowerCase().includes('job');
  const isServiceSubcategory = subcategoryName === 'Services' && categoryName === 'Services & Jobs';

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
    const onChange = (result: any) => setScreenWidth(result.window.width);
    const handler = Platform.OS === 'web' ? Dimensions.addEventListener('change', onChange) : null;

    loadUploadLimits();
    loadLocations();
    if (slug) fetchAd(slug);

    return () => { handler?.remove(); };
  }, [slug]);

  const fetchAd = async (adSlug: string) => {
    try {
      setLoading(true);
      const response = await adsService.getMyAd(adSlug);
      if (response.success && response.data) {
        const adData = response.data;
        setAd(adData);
        setNotFound(false); // Reset notFound state when ad is found

        // Clear validation errors when loading ad data
        setErrors({});
        setShowValidationError(false);

        setFormData({
          title: adData.title,
          description: adData.description,
          price: adData.price?.toString() || '',
          discountedPrice: adData.discountedPrice?.toString() || '',
          useDiscountedPrice: !!adData.discountedPrice,
          enableBooking: adData.enableBooking || false,
          categoryId: adData.categoryId || '',
          attachment: Array.isArray(adData.attachment) ? adData.attachment : [],
          bookingType: 'SLOTS',
          slots: adData.slots || [],
          // Map verbose location fields to AdLocation object
          location: adData.locationLatitude && adData.locationLongitude ? {
            latitude: adData.locationLatitude,
            longitude: adData.locationLongitude,
            address: {
              road: adData.locationRoad,
              house_number: adData.locationHouseNumber,
              city: adData.locationCity,
              state: adData.locationState,
              country: adData.locationCountry || 'India',
              postalCode: adData.locationPostalCode,
              formatted: adData.locationFormatted || ''
            },
            displayName: adData.locationFormatted || ''
          } : undefined,
        });
        setImages(adData.images || []);
        setCategoryName(adData.category?.name || '');
        setSubcategoryName(adData.subcategory?.name || '');

        if (adData.subcategoryId) loadAttributes(adData.subcategoryId);
        if (adData.attributes) {
          const values: Record<string, string> = {};
          adData.attributes.forEach((attr: any) => { values[attr.attributeId] = attr.value; });
          setAttributeValues(values);
        }
      } else {
        setNotFound(true);
      }
    } catch (e: any) {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  };

  const loadUploadLimits = async () => {
    try {
      const response = await fileUploadService.getUploadLimits();
      if (response.success && response.data) setUploadLimits(response.data);
    } catch (e) { }
  };

  const loadLocations = async () => {
    try {
      const response = await locationsService.getLocations({ limit: 100 });
      if (response.success && response.data) setLocations(response.data);
    } catch (e) { }
  };

  const loadAttributes = async (subcategoryId: string) => {
    try {
      const response = await categoriesService.getSubcategoryAttributes(subcategoryId);
      if (response.success && response.data) setAttributes(response.data);
    } catch (e) { }
  };

  const handleInputChange = (field: string, value: string | boolean | AdLocation | null) => {
    const prevFormData = { ...formData };
    setFormData(prev => ({ ...prev, [field]: value }));

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
      showAlert({ title: 'Permission needed', message: 'Please grant camera roll permissions', type: 'warning' });
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsMultipleSelection: true,
    });

    if (!result.canceled && result.assets) {
      const newImages = result.assets.map((asset: any) => asset.uri);
      setImages(prev => [...prev, ...newImages].slice(0, MAX_IMAGES));
      if (uploadLimits) await handleUploadImages(result.assets);
    }
  };

  const handleUploadImages = async (assets: ImagePicker.ImagePickerAsset[]) => {
    if (!uploadLimits) return;
    setIsUploading(true);
    setUploadError(null);

    try {
      const response = await fileUploadService.uploadImagesFromAssets(assets, {
        onProgress: (progress) => setUploadProgress(progress)
      });
      if (response.success && response.data?.files) {
        setUploadedFiles(prev => [...prev, ...response.data!.files]);
      }
    } catch (e: any) {
      setUploadError(e.message || 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  const removeImage = (index: number) => {
    const removedImage = images[index];
    setImages(prev => prev.filter((_, i) => i !== index));
    setImageUploadStatus(prev => prev.filter(s => s.index !== index));

    // Also remove from uploadedFiles if it's a newly uploaded image
    // Extract UUID from blob URL and match with filename
    let extractedId: string | null = null;
    if (removedImage && removedImage.includes('blob:')) {
      const urlParts = removedImage.split('/');
      const lastPart = urlParts[urlParts.length - 1];
      extractedId = lastPart;
    }

    const uploadedFileIndex = uploadedFiles.findIndex(file => {
      if (!extractedId) return false;
      const idWithUnderscores = extractedId.replace(/-/g, '_');
      return file.filename.includes(idWithUnderscores);
    });

    if (uploadedFileIndex !== -1) {
      const fileToDelete = uploadedFiles[uploadedFileIndex];
      setUploadedFiles(prev => prev.filter((_, i) => i !== uploadedFileIndex));
      fileUploadService.deleteFile(fileToDelete.path).catch(() => {});
    }
  };

  const handleToggleDropdown = (dropdown: string) => {
    if (dropdown.startsWith('attr_')) {
      const attrId = dropdown.replace('attr_', '');
      setAttributeDropdowns(prev => ({ ...prev, [attrId]: !prev[attrId] }));
      return;
    }
    if (dropdown === 'showAdTypeOptions') setShowAdTypeOptions(!showAdTypeOptions);
    if (dropdown === 'showLocationOptions') setShowLocationOptions(!showLocationOptions);
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

    // Validate images - check both existing images and newly uploaded files
    const totalImages = Math.max(images.length, uploadedFiles.length);
    const requiredImagesCount = (isJobCategory || isServiceSubcategory) ? 0 : REQUIRED_IMAGES;
    
    if (totalImages < requiredImagesCount) {
      const remainingImages = requiredImagesCount - totalImages;
      newErrors.images = `Minimum ${requiredImagesCount} images required. Please add ${remainingImages} more photo${remainingImages > 1 ? 's' : ''}.`;
    }

    // Validate attributes using the enhanced validation
    const attributeErrors = validateAttributes(attributeValues, attributes);
    Object.assign(newErrors, attributeErrors);

    setErrors(newErrors);
    return { isValid: Object.keys(newErrors).length === 0, errors: newErrors };
  };

  const handleSubmit = async () => {
    const validationResult = validateForm();
    if (!validationResult.isValid || !ad) {
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

    setIsSubmitting(true);
    try {
      // Combine existing images with newly uploaded files
      // For edit mode, we need to preserve old images and add new ones
      const imageUrls = uploadedFiles.length > 0
        ? [
            ...images.filter(img => !img.includes('blob:')), // Keep existing non-blob URLs
            ...uploadedFiles.map(f => f.url) // Add newly uploaded files
          ]
        : images;

      // Convert attributeValues to the format expected by the API
      const attributesArray = Object.entries(attributeValues)
        .filter(([_, value]) => value !== undefined && value !== '')
        .map(([attributeId, value]) => ({ attributeId, value }));

      const updateData: any = {
        title: formData.title,
        description: formData.description,
        price: parseFloat(formData.price) || null,
        // Use verbose location fields instead of locationId
        locationLatitude: formData.location?.latitude,
        locationLongitude: formData.location?.longitude,
        locationRoad: formData.location?.address?.road || undefined,
        locationHouseNumber: formData.location?.address?.house_number || undefined,
        locationCity: formData.location?.address?.city || undefined,
        locationState: formData.location?.address?.state || undefined,
        locationCountry: formData.location?.address?.country || undefined,
        locationPostalCode: formData.location?.address?.postalCode || undefined,
        locationFormatted: formData.location?.displayName || undefined,
        enableBooking: formData.enableBooking,
        bookingType: formData.bookingType,
        slots: formData.slots,
        images: imageUrls,
        attachment: formData.attachment || undefined,
        attributes: attributesArray,
      };

      if (formData.useDiscountedPrice && formData.discountedPrice) {
        updateData.discountedPrice = parseFloat(formData.discountedPrice);
      } else {
        updateData.discountedPrice = null;
      }

      const response = await adsService.updateAd(ad.id, updateData);
      if (response.success) {
        showAlert({ title: 'Success', message: 'Ad updated successfully', type: 'success' });
        router.replace(`/(pages)/ad-stats/${ad.slug || ad.id}`);
      } else {
        showAlert({ title: 'Error', message: 'Failed to update ad', type: 'error' });
      }
    } catch (e: any) {
      showAlert({ title: 'Error', message: e?.message || 'Failed to update ad', type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.light.primary} />
        </View>
      </ThemedView>
    );
  }

  if (notFound) {
    return (
      <AuthProtection>
          <ThemedView style={styles.container}>
            <AdNotFound404 />
            <Footer />
          </ThemedView>
      </AuthProtection>
    );
  }

  const content = (
    <>
      <View style={[styles.header, isDesktop && styles.desktopHeader]}>
        <TouchableOpacity onPress={goBack} style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={24} color={Colors.light.text} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <ThemedText style={styles.headerTitle}>Edit Ad</ThemedText>
          <ThemedText style={styles.headerSubtitle}>{categoryName} › {subcategoryName}</ThemedText>
        </View>
      </View>

      {showValidationError && (
        <View style={[styles.errorBlock, isDesktop && styles.desktopErrorBlock]}>
          <View style={styles.errorBlockHeader}>
            <MaterialIcons name="error-outline" size={20} color="#D32F2F" />
            <ThemedText style={styles.errorBlockTitle}>Please Fix the Following Issues</ThemedText>
          </View>
          <ThemedText style={styles.errorText}>{validationErrorMessage}</ThemedText>
        </View>
      )}

      {!isDesktop && <MobilePlatformBanners ads={platformAds} position="top" style={{ marginVertical: 8, paddingHorizontal: 16 }} />}

      <View style={isDesktop ? styles.desktopHomeWrapper : null}>
        {isDesktop && (
          <SideBanners
            ads={platformAds.filter(ad => ad.position === PlatformAdPosition.LEFT)}
            position={PlatformAdPosition.LEFT}
          />
        )}

        <View style={isDesktop ? styles.desktopMainContent : null}>
          <View style={[isDesktop ? styles.desktopContent : null]}>
        {!(subcategoryName === 'Job Vacancies' || subcategoryName === 'Post Resume' || subcategoryName === 'Looking for Work' || isServiceSubcategory) && (
          <ImageUploadSection
            images={images}
            isUploading={isUploading}
            errors={errors}
            onImagePicker={handleImagePicker}
            onRemoveImage={removeImage}
            uploadedCount={uploadedFiles.length}
            uploadProgress={uploadProgress}
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
            onAttachmentChange={(value) => handleInputChange('attachment', value as any)}
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
          />
        )}
        <BookingConfigSection
          formData={formData}
          onInputChange={handleInputChange}
          categoryName={categoryName}
          isEditing={true}
        />
        <LocationSection
          formData={formData}
          errors={errors}
          onInputChange={(field, value) => handleInputChange(field, value as any)}
        />

        <View style={styles.submitContainer}>
          <GradientButton
            title={isSubmitting ? 'Updating...' : 'Update Ad'}
            onPress={handleSubmit}
            loading={isSubmitting}
            disabled={isSubmitting}
          />
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
    </>
  );

  return (
    <AuthProtection>
        <ScrollView ref={scrollViewRef} style={styles.container} showsVerticalScrollIndicator={false}>
          {content}
        </ScrollView>
    </AuthProtection>
  );
}

const styles = StyleSheet.create({
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
    maxWidth: 800,
    position: 'relative',
  },
  desktopContent: {
    width: '100%',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 110,
    paddingBottom: 16,
    backgroundColor: Colors.light.card,
  },
  desktopHeader: {
    paddingTop: 32,
    maxWidth: 800,
    width: '100%',
    alignSelf: 'center',
  },
  backButton: {
    padding: 8,
    marginRight: 12,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.light.text,
  },
  headerSubtitle: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    // marginTop: 2,
  },
  errorBlock: {
    backgroundColor: '#FFEBEE',
    borderLeftWidth: 4,
    borderLeftColor: '#D32F2F',
    padding: 16,
    marginHorizontal: 0,
    marginBottom: 16,
    borderRadius: 0,
  },
  desktopErrorBlock: {
    maxWidth: 800,
    width: '100%',
    alignSelf: 'center',
    borderRadius: 8,
    paddingHorizontal: 16,
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
  formContainer: {
    paddingHorizontal: 0,
    paddingBottom: 40,
  },
  desktopFormContainer: {
    maxWidth: 800,
    width: '100%',
    alignSelf: 'center',
  },
  submitContainer: {
    marginTop: 24,
    marginBottom: 20,
    paddingHorizontal: 16
  },
});
