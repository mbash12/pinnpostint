import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, router, useFocusEffect } from 'expo-router';
import { useEffect, useState, useCallback } from 'react';
import { Dimensions, Image, Linking, Platform, Pressable, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { NetworkImage } from '@/components/ui/network-image';
import { PriceDisplay } from '@/components/shared/price-display';
import { ActionButtons } from '@/components/shared/action-buttons';
import { AttributesList } from '@/components/shared/attributes-list';
import { GradientButton } from '@/components/ui/gradient-button';
import { ImageCarousel } from '@/components/ui/image-carousel';
import { Footer } from '@/components/footer';
import { MobilePlatformBanners } from '@/components/mobile-platform-banners';

import { AuthProtection } from '@/components/auth-protection';
import { SideBanners } from '@/components/home/side-banners';
import { Colors } from '@/constants/theme';
import { useResponsive } from '@/hooks/use-responsive';
import { adsService, CreateAdRequest } from '@/services/ads.service';
import { fileUploadService } from '@/services/file-upload.service';
import { categoriesService, Attribute } from '@/services/categories.service';
import { settingsService } from '@/services/settings.service';
import { adDataStorage, type AdData } from '@/utils/ad-data-storage';
import { formatPrice } from '@/utils/price-formatter';
import { AdLocation } from '@/types/location.types';
import { getAdPlaceholder } from '@/constants/placeholders';
import * as ImagePicker from 'expo-image-picker';
import { useAlert } from '@/components/ui/custom-alert';
import { useAuth } from '@/contexts/auth-context';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { platformAdsService, apiService } from '@/services';
import type { PlatformAd } from '@/types/api.types';
import { PlatformAdPosition } from '@/types/api.types';

const { width } = Dimensions.get('window');

interface SubscriptionSettings {
  subscriptionPrice: number;
  subscriptionDuration: number;
  freeAdDuration: number;
  reminderExpirationDays: number;
  subscriptionCurrency: string;
}

export default function AdPreviewPage() {
  const [adData, setAdData] = useState<AdData | null>(null);
  const [attributes, setAttributes] = useState<Attribute[]>([]);
  const [isFavorite, setIsFavorite] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [subscriptionSettings, setSubscriptionSettings] = useState<SubscriptionSettings>({
    subscriptionPrice: 99,
    subscriptionDuration: 7,
    freeAdDuration: 3,
    reminderExpirationDays: 3,
    subscriptionCurrency: 'INR'
  });
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const { isDesktop } = useResponsive();
  const { showAlert } = useAlert();
  const { user } = useAuth();
  const [platformAds, setPlatformAds] = useState<PlatformAd[]>([]);
  const [isLoadingPlatformAds, setIsLoadingPlatformAds] = useState(true);
  const [screenWidth, setScreenWidth] = useState(Dimensions.get('window').width);
  const [publisherStats, setPublisherStats] = useState<{ activeAds: number; memberSince: string } | null>(null);
  const [phoneRevealed, setPhoneRevealed] = useState(false);

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

  // Load subscription settings once on mount
  useEffect(() => {
    loadSubscriptionSettings();
  }, []);

  // Reload ad data when page gains focus (when coming back from edit)
  useFocusEffect(
    useCallback(() => {
      const loadAdData = async () => {
        try {
          const data = await adDataStorage.retrieve();
          if (data) {
            setAdData(data);

            // Load attributes for this category
            if (data.categoryId) {
              try {
                const response = await categoriesService.getCategoryAttributes(data.categoryId);
                if (response.success && response.data) {
                  setAttributes(response.data);
                }
              } catch (error) {
              }
            }
          } else {
            showAlert({
              title: 'Error',
              message: 'No preview data found. Please go back and try again.',
              type: 'error'
            });
            router.back();
          }
        } catch (error) {
          showAlert({
            title: 'Error',
            message: 'Failed to load preview data',
            type: 'error'
          });
          router.back();
        }
      };

      loadAdData();
    }, [])
  );

  const loadSubscriptionSettings = async () => {
    try {
      const settings = await settingsService.getSubscriptionSettings();
      setSubscriptionSettings(settings);
    } catch (error) {
    }
  };

  const getLocationName = () => {
    if (!adData?.formData.location) {
      return 'Location not specified';
    }
    const location = adData.formData.location;
    return location.displayName || location.address?.formatted || 'Location';
  };

  // Censor phone number - replace digits with asterisks
  const censorPhoneNumber = (phone: string): string => {
    if (!phone) return '**********';
    const censored = phone.replace(/\d/g, '*');
    return censored;
  };

  // Fetch publisher stats
  const fetchPublisherStats = async (userId: string) => {
    try {
      const response = await apiService.get<{ activeAds: number; memberSince: string }>(`/public/users/${userId}/stats`);

      if (response.success && response.data) {
        const activeAds = response.data.activeAds || 0;
        let memberSince = '';

        if (response.data.memberSince) {
          const date = new Date(response.data.memberSince);
          memberSince = `Member since ${date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`;
        }

        setPublisherStats({ activeAds, memberSince });
      } else {
        setPublisherStats({ activeAds: 0, memberSince: '' });
      }
    } catch (e) {
      setPublisherStats({ activeAds: 0, memberSince: '' });
    }
  };

  // Fetch publisher stats when user is available
  useEffect(() => {
    if (user?.id) {
      fetchPublisherStats(user.id);
    }
  }, [user?.id]);

  // Get display images - prefer uploaded file URLs over local URIs
  const getDisplayImages = (): string[] => {
    if (!adData) return [];

    // If we have uploaded files, use those URLs (they persist after refresh)
    if (adData.uploadedFiles && adData.uploadedFiles.length > 0) {
      return adData.uploadedFiles.map(file => file.url);
    }

    // Otherwise, use the images array (might contain local URIs)
    return adData.images || [];
  };

  const loadAttributes = async (categoryId: string) => {
    try {
      const response = await categoriesService.getCategoryAttributes(categoryId);
      if (response.success && response.data) {
        setAttributes(response.data);
      }
    } catch (error) {
    }
  };

  const handleEdit = async () => {
    // Don't clear storage - the form will reload from storage
    // This allows the form to show current data when user navigates back
    router.back();
  };

  const handleWhatsApp = () => {
    // Preview mode - show message but don't actually open WhatsApp
    showAlert({
      title: 'Preview Mode',
      message: 'This is preview mode. WhatsApp will be available after posting.',
      type: 'info'
    });
  };

  const handleBooking = () => {
    // Preview mode - show message but don't actually open booking
    showAlert({
      title: 'Preview Mode', 
      message: 'This is preview mode. Booking will be available after posting.',
      type: 'info'
    });
  };

  const handlePostAdClick = () => {
    if (!adData) {
      showAlert({
        title: 'Error',
        message: 'No ad data available',
        type: 'error'
      });
      return;
    }
    setShowConfirmDialog(true);
  };

  const handleConfirmSubmit = async () => {
    setShowConfirmDialog(false);
    
    if (!adData) {
      showAlert({
        title: 'Error',
        message: 'No ad data available',
        type: 'error'
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Create ad in API directly without payment
      const adResult = await createAdInAPI();

      if (!adResult) {
        throw new Error('Failed to create ad');
      }

      // Clear storage and navigate to success
      await adDataStorage.clear();

      router.replace({
        pathname: '/(pages)/create-ad/payment-success',
        params: { 
          adId: adResult.id
        }
      });
    } catch (error: any) {
      const message = error.message || 'Ad creation failed. Please try again.';
      showAlert({
        title: 'Ad Creation Failed',
        message,
        type: 'error'
      });
    } finally {
      setIsSubmitting(false);
    }
  };


  const createAdInAPI = async () => {
    if (!adData) throw new Error('No ad data available');

    try {
      // Get category and subcategory IDs if not provided
      let categoryId = adData.categoryId;
      let subcategoryId = adData.subcategoryId;

      if (!categoryId && adData.categoryName) {
        categoryId = (await categoriesService.findCategoryIdByName(adData.categoryName)) || undefined;
      }

      if (!subcategoryId && categoryId && adData.subcategoryName) {
        subcategoryId = (await categoriesService.findSubcategoryIdByName(adData.subcategoryName, categoryId)) || undefined;
      }

      if (!categoryId) {
        throw new Error('Category not found');
      }

      // Use the location object from form data
      const location = adData.formData.location;

      // Use already uploaded image URLs from uploadedFiles
      let imageUrls: string[] = [];
      if (adData.uploadedFiles && adData.uploadedFiles.length > 0) {
        // Images are already uploaded, use their URLs
        imageUrls = adData.uploadedFiles.map(file => file.url);
      } else if (adData.images && adData.images.length > 0) {
        // Fallback: check if images are already URLs
        imageUrls = adData.images.filter(uri => uri.startsWith('http'));
      }

      // Fetch actual attributes for this category
      const attributesResponse = await categoriesService.getCategoryAttributes(categoryId!);
      const availableAttributes = attributesResponse.success ? attributesResponse.data : [];

      // Map form attributes to API attributes
      const attributes = getAdAttributes(availableAttributes || []);

      // Create ad data object matching API expectations with verbose location fields
      const createAdData: CreateAdRequest = {
        title: adData.formData.title,
        description: adData.formData.description,
        price: parseFloat(adData.formData.price.replace(/[^0-9.]/g, '')) || null,
        discountedPrice: adData.formData.useDiscountedPrice && adData.formData.discountedPrice
          ? parseFloat(adData.formData.discountedPrice.replace(/[^0-9.]/g, ''))
          : null,
        categoryId: categoryId!,
        subcategoryId: subcategoryId || undefined,
        // Verbose location fields from Google Maps
        locationLatitude: location?.latitude,
        locationLongitude: location?.longitude,
        locationRoad: location?.address?.road || undefined,
        locationHouseNumber: location?.address?.house_number || undefined,
        locationCity: location?.address?.city || undefined,
        locationState: location?.address?.state || undefined,
        locationCountry: location?.address?.country || undefined,
        locationPostalCode: location?.address?.postalCode || undefined,
        locationFormatted: location?.displayName || location?.address?.formatted,
        enableBooking: adData.formData.enableBooking || false,
        bookingType: 'SLOTS',
        slots: adData.formData.slots || [],
        attributes,
        images: imageUrls, // API expects 'images' not 'imageUrls'
        attachment: adData.formData.attachment || undefined,
      };


      // Submit to API
      const response = await adsService.createAd(createAdData);

      if (!response.success) {
        throw new Error(response.message || 'Failed to create ad');
      }

      return response.data;
    } catch (error) {
      throw error;
    }
  };

  const getAdAttributes = (availableAttributes: Attribute[]) => {
    if (!adData) return [];

    const attributes: NonNullable<CreateAdRequest['attributes']> = [];

    // Add dynamic attributes from attributeValues
    if (adData.attributeValues) {
      Object.entries(adData.attributeValues).forEach(([attrId, value]) => {
        if (value) {
          attributes.push({ attributeId: attrId, value: String(value) });
        }
      });
    }

    return attributes;
  };

  // Helper function to get attachments (similar to ad detail page)
  const getAttachments = () => {
    const attachments = [];

    if (adData?.formData.attachment && Array.isArray(adData.formData.attachment)) {
      adData.formData.attachment.forEach((url, index) => {
        attachments.push({
          icon: 'description',
          label: adData.formData.attachment!.length > 1 ? `Attachment ${index + 1}` : 'Attachment',
          value: url,
          type: 'file'
        });
      });
    }

    return attachments;
  };

  const getAttributes = () => {
    const attributesList = [];

    // Add dynamic attributes from form
    if (adData?.attributeValues && attributes.length > 0) {
      attributes.forEach(attr => {
        const value = adData.attributeValues?.[attr.id];
        if (value) {
          // Map attribute types to appropriate icons
          let icon = 'label'; // Default icon (same as detail page)
          switch (attr.type) {
            case 'file':
              icon = 'description';
              break;
            case 'select':
              icon = 'category';
              break;
            case 'number':
              icon = 'numbers';
              break;
            case 'boolean':
              icon = value === 'true' ? 'check-circle' : 'cancel';
              break;
            case 'date':
              icon = 'date-range';
              break;
            default:
              icon = 'label';
          }

          // Format as "Label: Value" to match detail page
          const displayValue = attr.type === 'boolean'
            ? (value === 'true' ? 'Yes' : 'No')
            : value;

          attributesList.push({
            icon,
            value: `${attr.name}: ${displayValue}`
          });
        }
      });
    }

    if (adData?.formData.enableBooking) {
      const value = `Appointment Slots (${adData.formData.slots?.length || 0})`;
      attributesList.push({ icon: 'verified', value });
    }

    if (adData?.formData.useDiscountedPrice) {
      attributesList.push({ icon: 'local-offer', value: 'Discount Available' });
    }

    return attributesList;
  };

  if (!adData) {
    return (
        <View style={styles.loadingContainer}>
          <ThemedText>Loading preview...</ThemedText>
        </View>
    );
  }

  const price = formatPrice(adData.formData.price);
  const discountPrice = adData.formData.useDiscountedPrice
    ? formatPrice(adData.formData.discountedPrice)
    : undefined;
  const hasPrice = adData.formData.price && adData.formData.price.trim() !== '' && parseFloat(adData.formData.price) > 0;
  const hasDiscountPrice = adData.formData.useDiscountedPrice && adData.formData.discountedPrice && adData.formData.discountedPrice.trim() !== '';

  const hasNoImages = getDisplayImages().length === 0;

  // Get standardized placeholder for jobs/services if no images provided
  const adPlaceholder = getAdPlaceholder(
    adData.categoryName || undefined, 
    adData.subcategoryName || undefined,
    adData.categoryPlaceholder || undefined
  );

  // Mobile View
  const mobileView = (
    <>
      {/* Content - Exact Match to Detail Page */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header - Moved down to avoid overlap */}
        <View style={styles.mobileHeader}>
          <TouchableOpacity style={styles.backButton} onPress={handleEdit}>
            <MaterialIcons name="arrow-back" size={24} color={Colors.light.text} />
          </TouchableOpacity>
          <ThemedText style={styles.headerTitle}>Ad Preview</ThemedText>
          <TouchableOpacity style={styles.editButton} onPress={handleEdit}>
            <MaterialIcons name="edit" size={20} color={Colors.light.primary} />
            <ThemedText style={styles.editText}>Edit</ThemedText>
          </TouchableOpacity>
        </View>

        {/* Immersive Banner - Using ImageCarousel like detail page */}
        <ThemedView style={styles.bannerContainer}>
          <ImageCarousel
            images={hasNoImages && adPlaceholder ? [adPlaceholder] : getDisplayImages()}
            imageWidth={width}
            imageHeight={width * 0.8}
            onIndexChange={(index) => {}}
          />
          <LinearGradient
            colors={['rgba(255, 255, 255, 1)', 'transparent']}
            style={styles.topGradient}
            pointerEvents="none"
          />
          <LinearGradient
            colors={['transparent', 'rgba(255, 255, 255, 1)']}
            style={styles.bottomGradient}
            pointerEvents="none"
          />
        </ThemedView>

        {/* Title and Location - Exact match to detail page */}
        <ThemedView style={styles.titleSection}>
          <ThemedView >
            {/* Category and Subcategory - Just like detail page */}
            {adData.categoryName && (
              <View style={styles.categoryContainer}>
                <ThemedText style={styles.categoryName}>{adData.categoryName}</ThemedText>
                {adData.subcategoryName && (
                  <>
                    <MaterialIcons name="chevron-right" size={14} color={Colors.light.textSecondary} />
                    <ThemedText style={styles.subcategoryName}>{adData.subcategoryName}</ThemedText>
                  </>
                )}
              </View>
            )}
          </ThemedView>

          <ThemedView style={styles.titleRow}>
            <ThemedView style={styles.titleContainer}>
              <ThemedText type="subtitle" style={styles.title}>{adData.formData.title || 'Ad Title'}</ThemedText>
            </ThemedView>
            <View style={styles.readonlyFavoriteButton}>
              <MaterialIcons
                name={isFavorite ? 'favorite' : 'favorite-border'}
                size={28}
                color={isFavorite ? Colors.light.primary : Colors.light.textSecondary}
              />
            </View>
          </ThemedView>
          {(hasPrice || hasDiscountPrice) && (
            <ThemedView style={styles.priceSection}>
              <PriceDisplay
                price={price}
                discountPrice={discountPrice}
                size="small"
              />
            </ThemedView>
          )}
        </ThemedView>

        {/* Action Buttons - Readonly for preview */}
        <ThemedView style={styles.actionSection}>
          {/* Share Button - Readonly */}
          <View style={styles.readonlyShareButton}>
            <MaterialIcons name="share" size={20} color={Colors.light.textSecondary} />
          </View>

          <View style={[styles.readonlyButton, styles.whatsappButton]}>
            <ThemedText style={styles.readonlyText}>WhatsApp</ThemedText>
          </View>

          {adData?.formData?.enableBooking && (
            <View style={[styles.readonlyButton, styles.bookingButton]}>
              <LinearGradient
                colors={[Colors.light.gradientStart, Colors.light.gradientEnd]}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={styles.readonlyGradient}
              >
                <ThemedText style={styles.readonlyBookingText}>Book Now</ThemedText>
              </LinearGradient>
            </View>
          )}
        </ThemedView>

        <MobilePlatformBanners ads={platformAds} position="top" style={{ marginVertical: 8, paddingHorizontal: 16 }} />

        {/* Attributes - Exact match to detail page */}
        <ThemedView style={styles.section}>
          <ThemedView style={styles.sectionContent}>
            <ThemedText type="subtitle" style={styles.sectionTitle}>Details</ThemedText>
          </ThemedView>
          <AttributesList
            attributes={getAttributes()}
            style={{ marginHorizontal: 20 }}
          />
        </ThemedView>

        {/* Booking Slots */}
        {adData?.formData?.enableBooking && adData.formData.slots && adData.formData.slots.length > 0 && (
          <ThemedView style={styles.section}>
            <ThemedView style={styles.sectionContent}>
              <ThemedText type="subtitle" style={styles.sectionTitle}>Appointment Slots</ThemedText>
            </ThemedView>
            <View style={styles.slotsContainer}>
              {(() => {
                const slotsByDate: Record<string, typeof adData.formData.slots> = {};
                adData.formData.slots.forEach(slot => {
                  if (!slotsByDate[slot.date]) {
                    slotsByDate[slot.date] = [];
                  }
                  slotsByDate[slot.date].push(slot);
                });
                return Object.entries(slotsByDate).map(([date, dateSlots]) => (
                  <View key={date} style={styles.slotDayGroup}>
                    <ThemedText style={styles.slotDayLabel}>{date}</ThemedText>
                    <View style={styles.slotTimesContainer}>
                      {dateSlots.map((slot, idx) => (
                        <View key={idx} style={styles.slotChip}>
                          <MaterialIcons name="access-time" size={14} color={Colors.light.textSecondary} />
                          <ThemedText style={styles.slotTimeText}>{slot.startTime} - {slot.endTime}</ThemedText>
                        </View>
                      ))}
                    </View>
                  </View>
                ));
              })()}
            </View>
          </ThemedView>
        )}

        {/* Attachments */}
        {getAttachments().length > 0 && (
          <ThemedView style={styles.section}>
            <ThemedView style={styles.sectionContent}>
              <ThemedText type="subtitle" style={styles.sectionTitle}>Attachments</ThemedText>
            </ThemedView>
            <AttributesList
              attributes={getAttachments()}
              style={{ marginHorizontal: 20 }}
            />
          </ThemedView>
        )}

        {/* Publisher Section */}
        <ThemedView style={styles.section}>
          <ThemedView style={styles.sectionContent}>
            <ThemedText type="subtitle" style={styles.sectionTitle}>Publisher</ThemedText>
          </ThemedView>
          <View style={styles.publisherCard}>
            <View style={styles.publisherHeader}>
              <View style={styles.publisherAvatarContainer}>
                {user?.avatar ? (
                  <NetworkImage
                    source={{ uri: user.avatar }}
                    style={styles.publisherAvatarImage}
                    resizeMode="cover"
                  />
                ) : (
                  <ThemedText style={styles.publisherAvatar}>
                    {user?.firstName?.charAt(0)?.toUpperCase() || 'U'}
                  </ThemedText>
                )}
              </View>
              <View style={styles.publisherInfo}>
                <ThemedText style={styles.publisherName}>
                  {user?.firstName || 'User'} {user?.lastName || ''}
                </ThemedText>
                {publisherStats && (
                  <View style={styles.publisherStats}>
                    <ThemedText style={styles.publisherStatText}>
                      {publisherStats.activeAds} active ad{publisherStats.activeAds !== 1 ? 's' : ''}{publisherStats.memberSince ? ` • ${publisherStats.memberSince}` : ''}
                    </ThemedText>
                  </View>
                )}
              </View>
              <MaterialIcons name="chevron-right" size={24} color={Colors.light.textSecondary} />
            </View>

            {/* Contact Actions - Preview Mode */}
            <View style={styles.publisherContactSection}>
              {/* Contact Number */}
              {user?.phone && (
                <View style={styles.contactNumberRow}>
                  <MaterialIcons name="phone" size={18} color={Colors.light.textSecondary} />
                  <ThemedText style={styles.contactNumberText}>
                    {censorPhoneNumber(user.phone)} <ThemedText style={styles.revealText}>Tap to reveal</ThemedText>
                  </ThemedText>
                </View>
              )}

              {/* Chat Button - Preview Mode */}
              <View
                style={styles.chatIconButton}
              >
                <MaterialIcons name="chat-bubble-outline" size={20} color={Colors.light.primary} />
                <ThemedText style={styles.chatIconText}>Chat</ThemedText>
              </View>
            </View>
          </View>
        </ThemedView>
        <ThemedView style={styles.section}>
          <AttributesList
            attributes={getAttributes()}
            style={{ marginHorizontal: 20 }}
          />
        </ThemedView>

        {/* Description - Exact match to detail page */}
        <ThemedView style={styles.section}>
          <ThemedView style={styles.sectionContent}>
            <ThemedText type="subtitle" style={styles.sectionTitle}>Description</ThemedText>
          </ThemedView>
          <ThemedView style={styles.descriptionContainer}>
            <ThemedText style={styles.description}>
              {adData.formData.description || 'Ad description will appear here...'}
            </ThemedText>
          </ThemedView>
        </ThemedView>

        {/* Location Section - Just like detail page */}
        <ThemedView style={styles.section}>
          <ThemedView style={styles.sectionContent}>
            <ThemedText type="subtitle" style={styles.sectionTitle}>Location</ThemedText>
          </ThemedView>
          <ThemedView style={styles.locationContainer}>
            <View style={styles.addressRow}>
              <MaterialIcons name="location-on" size={18} color={Colors.light.primary} />
              <ThemedText style={styles.locationSectionText}>
                {getLocationName()}
              </ThemedText>
            </View>
            {adData?.formData?.location?.latitude && adData?.formData?.location?.longitude && (
              <View style={styles.mapContainer}>
                <ThemedText style={styles.mapPlaceholder}>
                  Map preview will be available after posting
                </ThemedText>
              </View>
            )}
          </ThemedView>
        </ThemedView>

        {/* Posting Terms Section */}
        <ThemedView style={styles.section}>
          <ThemedView style={styles.sectionContent}>
            <ThemedText type="subtitle" style={styles.sectionTitle}>Posting Terms</ThemedText>
          </ThemedView>
          <ThemedView style={styles.postingTermsCard}>
            {/* Free Period */}
            <View style={styles.postingTermRow}>
              <View style={styles.postingTermIconContainer}>
                <MaterialIcons name="schedule" size={20} color={Colors.light.primary} />
              </View>
              <View style={styles.postingTermContent}>
                <ThemedText style={styles.postingTermLabel}>Free Period</ThemedText>
                <ThemedText style={styles.postingTermValue}>
                  Your ad will be live for {subscriptionSettings.freeAdDuration} days at no cost
                </ThemedText>
              </View>
            </View>
            
            {/* Divider */}
            <View style={styles.postingTermDivider} />
            
            {/* Extension Info */}
            <View style={styles.postingTermRow}>
              <View style={styles.postingTermIconContainer}>
                <MaterialIcons name="upgrade" size={20} color={Colors.light.primary} />
              </View>
              <View style={styles.postingTermContent}>
                <ThemedText style={styles.postingTermLabel}>Extend Your Ad</ThemedText>
                <ThemedText style={styles.postingTermValue}>
                  Extend for {subscriptionSettings.subscriptionDuration} days at just ₹{subscriptionSettings.subscriptionPrice}
                </ThemedText>
              </View>
            </View>
          </ThemedView>
        </ThemedView>

        {/* Submit Button - Under Posting Terms */}
        <View style={styles.submitContainerInline}>
          <GradientButton
            title="Post Ad"
            onPress={handlePostAdClick}
            loading={isSubmitting}
            disabled={isSubmitting}
            style={styles.submitButtonInline}
          />
        </View>

        <MobilePlatformBanners ads={platformAds} position="bottom" style={{ marginTop: 4, marginBottom: 24, paddingHorizontal: 16 }} />
        <Footer />
      </ScrollView>
    </>
  );

  // Desktop View - Exact Match to Detail Page
  const desktopView = (
    <View style={desktopStyles.container}>
      <ScrollView
        style={desktopStyles.scrollView}
        contentContainerStyle={desktopStyles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={desktopStyles.desktopHomeWrapper}>
          {isDesktop && (
            <SideBanners
              ads={platformAds.filter(ad => ad.position === PlatformAdPosition.LEFT)}
              position={PlatformAdPosition.LEFT}
            />
          )}

          <View style={desktopStyles.desktopMainContent}>
            {/* Header */}
            <View style={desktopStyles.header}>
              <TouchableOpacity style={styles.backButton} onPress={handleEdit}>
                <MaterialIcons name="arrow-back" size={24} color={Colors.light.text} />
              </TouchableOpacity>
              <ThemedText style={styles.headerTitle}>Ad Preview</ThemedText>
              <TouchableOpacity style={styles.editButton} onPress={handleEdit}>
                <MaterialIcons name="edit" size={20} color={Colors.light.primary} />
                <ThemedText style={styles.editText}>Edit</ThemedText>
              </TouchableOpacity>
            </View>

            <View style={desktopStyles.content}>
              <View style={desktopStyles.mainContent}>
            {/* Left Column: Images + Description */}
            <View style={desktopStyles.leftColumn}>
              {/* Image Gallery */}
              <View style={desktopStyles.imageSection}>
                <ImageCarousel
                  images={hasNoImages && adPlaceholder ? [adPlaceholder] : getDisplayImages()}
                  imageWidth={600}
                  imageHeight={400}
                  onIndexChange={() => {}}
                  showThumbnails={!hasNoImages}
                />
              </View>

              {/* Description - Under images */}
              <View style={desktopStyles.descriptionSection}>
                <ThemedText style={desktopStyles.sectionTitle}>Description</ThemedText>
                <View style={desktopStyles.descriptionContainer}>
                  <ThemedText style={desktopStyles.description}>
                    {adData.formData.description || 'Ad description will appear here...'}
                  </ThemedText>
                </View>
              </View>
            </View>

            {/* Right Column: Content */}
            <View style={desktopStyles.contentSection}>
              {/* Title and Actions */}
              <View style={desktopStyles.headerSection}>
                {/* Category and Subcategory */}
                {adData.categoryName && (
                  <View style={desktopStyles.categoryContainer}>
                    <ThemedText style={desktopStyles.categoryName}>{adData.categoryName}</ThemedText>
                    {adData.subcategoryName && (
                      <>
                        <MaterialIcons name="chevron-right" size={16} color={Colors.light.textSecondary} />
                        <ThemedText style={desktopStyles.subcategoryName}>{adData.subcategoryName}</ThemedText>
                      </>
                    )}
                  </View>
                )}

                <View style={desktopStyles.titleRow}>
                  <View style={desktopStyles.titleContainer}>
                    <ThemedText style={desktopStyles.title}>{adData.formData.title || 'Ad Title'}</ThemedText>
                  </View>
                  <View style={desktopStyles.readonlyFavoriteButton}>
                    <MaterialIcons
                      name={isFavorite ? "favorite" : "favorite-border"}
                      size={28}
                      color={isFavorite ? Colors.light.primary : Colors.light.textSecondary}
                    />
                  </View>
                </View>

                {(hasPrice || hasDiscountPrice) && (
                  <View style={desktopStyles.priceRow}>
                    {discountPrice ? (
                      <>
                        <ThemedText style={desktopStyles.discountPrice}>{discountPrice}</ThemedText>
                        <ThemedText style={desktopStyles.originalPrice}>{price}</ThemedText>
                      </>
                    ) : (
                      <ThemedText style={desktopStyles.discountPrice}>{price}</ThemedText>
                    )}
                  </View>
                )}
              </View>

              {/* Action Buttons */}
              <View style={desktopStyles.actionSection}>
                {/* Share Button - Readonly */}
                <View style={desktopStyles.readonlyShareButton}>
                  <MaterialIcons name="share" size={20} color={Colors.light.textSecondary} />
                </View>

                <View style={[desktopStyles.readonlyButton, desktopStyles.whatsappButton]}>
                  <ThemedText style={desktopStyles.readonlyText}>WhatsApp</ThemedText>
                </View>

                {adData?.formData?.enableBooking && (
                  <View style={[desktopStyles.readonlyButton, desktopStyles.bookingButton]}>
                    <LinearGradient
                      colors={[Colors.light.gradientStart, Colors.light.gradientEnd]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 0, y: 1 }}
                      style={desktopStyles.readonlyGradient}
                    >
                      <ThemedText style={desktopStyles.readonlyBookingText}>Book Now</ThemedText>
                    </LinearGradient>
                  </View>
                )}
              </View>

              {/* Attributes */}
              <View style={desktopStyles.section}>
                <ThemedText style={desktopStyles.sectionTitle}>Details</ThemedText>
                <AttributesList
                  attributes={getAttributes()}
                  isDesktop={true}
                />
              </View>

              {/* Booking Slots */}
              {adData?.formData?.enableBooking && adData.formData.bookingType === 'SLOTS' && adData.formData.slots && adData.formData.slots.length > 0 && (
                <View style={desktopStyles.section}>
                  <ThemedText style={desktopStyles.sectionTitle}>Appointment Slots</ThemedText>
                  <View style={desktopStyles.slotsContainer}>
                    {(() => {
                      const slotsByDate: Record<string, typeof adData.formData.slots> = {};
                      adData.formData.slots.forEach(slot => {
                        if (!slotsByDate[slot.date]) {
                          slotsByDate[slot.date] = [];
                        }
                        slotsByDate[slot.date].push(slot);
                      });
                      return Object.entries(slotsByDate).map(([date, dateSlots]) => (
                        <View key={date} style={desktopStyles.slotDayGroup}>
                          <ThemedText style={desktopStyles.slotDayLabel}>{date}</ThemedText>
                          <View style={desktopStyles.slotTimesContainer}>
                            {dateSlots.map((slot, idx) => (
                              <View key={idx} style={desktopStyles.slotChip}>
                                <MaterialIcons name="access-time" size={14} color={Colors.light.textSecondary} />
                                <ThemedText style={desktopStyles.slotTimeText}>{slot.startTime} - {slot.endTime}</ThemedText>
                              </View>
                            ))}
                          </View>
                        </View>
                      ));
                    })()}
                  </View>
                </View>
              )}

              {/* Publisher Section */}
              <View style={desktopStyles.section}>
                <ThemedText style={desktopStyles.sectionTitle}>Publisher</ThemedText>
                <View style={desktopStyles.publisherCard}>
                  <View style={desktopStyles.publisherHeader}>
                    <View style={desktopStyles.publisherAvatarContainer}>
                      {user?.avatar ? (
                        <NetworkImage
                          source={{ uri: user.avatar }}
                          style={desktopStyles.publisherAvatarImage}
                          resizeMode="cover"
                        />
                      ) : (
                        <ThemedText style={desktopStyles.publisherAvatar}>
                          {user?.firstName?.charAt(0)?.toUpperCase() || 'U'}
                        </ThemedText>
                      )}
                    </View>
                    <View style={desktopStyles.publisherInfo}>
                      <ThemedText style={desktopStyles.publisherName}>
                        {user?.firstName || 'User'} {user?.lastName || ''}
                      </ThemedText>
                      {publisherStats && (
                        <View style={desktopStyles.publisherStats}>
                          <ThemedText style={desktopStyles.publisherStatText}>
                            {publisherStats.activeAds} active ad{publisherStats.activeAds !== 1 ? 's' : ''}{publisherStats.memberSince ? ` • ${publisherStats.memberSince}` : ''}
                          </ThemedText>
                        </View>
                      )}
                    </View>
                    <MaterialIcons name="chevron-right" size={24} color={Colors.light.textSecondary} />
                  </View>

                  {/* Contact Actions - Preview Mode */}
                  <View style={desktopStyles.publisherContactSection}>
                    {/* Contact Number */}
                    {user?.phone && (
                      <View style={desktopStyles.contactNumberRow}>
                        <MaterialIcons name="phone" size={18} color={Colors.light.textSecondary} />
                        <ThemedText style={desktopStyles.contactNumberText}>
                          {censorPhoneNumber(user.phone)} <ThemedText style={desktopStyles.revealText}>Tap to reveal</ThemedText>
                        </ThemedText>
                      </View>
                    )}

                    {/* Chat Button - Preview Mode */}
                    <View
                      style={desktopStyles.chatIconButton}
                    >
                      <MaterialIcons name="chat-bubble-outline" size={20} color={Colors.light.primary} />
                      <ThemedText style={desktopStyles.chatIconText}>Chat</ThemedText>
                    </View>
                  </View>
                </View>
              </View>

              {/* Attachments */}
              {getAttachments().length > 0 && (
                <View style={desktopStyles.section}>
                  <ThemedText style={desktopStyles.sectionTitle}>Attachments</ThemedText>
                  <AttributesList
                    attributes={getAttachments()}
                    isDesktop={true}
                  />
                </View>
              )}

              {/* Location Section */}
              <View style={desktopStyles.section}>
                <ThemedText style={desktopStyles.sectionTitle}>Location</ThemedText>
                <View style={desktopStyles.locationContainer}>
                  <View style={desktopStyles.addressRow}>
                    <MaterialIcons name="location-on" size={20} color={Colors.light.primary} />
                    <ThemedText style={desktopStyles.locationSectionText}>
                      {getLocationName()}
                    </ThemedText>
                  </View>
                  {adData?.formData?.location?.latitude && adData?.formData?.location?.longitude && (
                    <View style={desktopStyles.mapContainer}>
                      <ThemedText style={desktopStyles.mapPlaceholder}>
                        Map preview will be available after posting
                      </ThemedText>
                    </View>
                  )}
                </View>
              </View>

              {/* Posting Terms Section */}
              <View style={desktopStyles.section}>
                <ThemedText style={desktopStyles.sectionTitle}>Posting Terms</ThemedText>
                <View style={desktopStyles.postingTermsCard}>
                  {/* Free Period */}
                  <View style={desktopStyles.postingTermRow}>
                    <View style={desktopStyles.postingTermIconContainer}>
                      <MaterialIcons name="schedule" size={22} color={Colors.light.primary} />
                    </View>
                    <View style={desktopStyles.postingTermContent}>
                      <ThemedText style={desktopStyles.postingTermLabel}>Free Period</ThemedText>
                      <ThemedText style={desktopStyles.postingTermValue}>
                        Your ad will be live for {subscriptionSettings.freeAdDuration} days at no cost
                      </ThemedText>
                    </View>
                  </View>

                  {/* Divider */}
                  <View style={desktopStyles.postingTermDivider} />

                  {/* Extension Info */}
                  <View style={desktopStyles.postingTermRow}>
                    <View style={desktopStyles.postingTermIconContainer}>
                      <MaterialIcons name="upgrade" size={22} color={Colors.light.primary} />
                    </View>
                    <View style={desktopStyles.postingTermContent}>
                      <ThemedText style={desktopStyles.postingTermLabel}>Extend Your Ad</ThemedText>
                      <ThemedText style={desktopStyles.postingTermValue}>
                        Extend for {subscriptionSettings.subscriptionDuration} days at just ₹{subscriptionSettings.subscriptionPrice}
                      </ThemedText>
                    </View>
                  </View>
                </View>
              </View>

              {/* Submit Button - Under Posting Terms */}
              <View style={desktopStyles.submitContainerInline}>
                <GradientButton
                  title="Post Ad"
                  onPress={handlePostAdClick}
                  loading={isSubmitting}
                  disabled={isSubmitting}
                  style={desktopStyles.submitButtonInline}
                />
              </View>
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
    </ScrollView>
    </View>
  );

  return (
    <AuthProtection>
        <View style={[styles.container, isDesktop && { backgroundColor: '#FFFFFF' }]}>
          {isDesktop ? desktopView : mobileView}
          {/* Confirmation Dialog - Shared between mobile and desktop */}
          <ConfirmDialog
            visible={showConfirmDialog}
            title="Post Your Ad?"
            message={`Your ad will be live for ${subscriptionSettings.freeAdDuration} days at no cost. You can extend it later for ${subscriptionSettings.subscriptionDuration} days at just ₹${subscriptionSettings.subscriptionPrice}.`}
            confirmText="Post Ad"
            cancelText="Cancel"
            onConfirm={handleConfirmSubmit}
            onCancel={() => setShowConfirmDialog(false)}
          />
        </View>
    </AuthProtection>
  );

}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mobileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    backgroundColor: '#FFFFFF',
    marginTop: 80, // More space below main header
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.light.text,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  editText: {
    color: Colors.light.primary,
    fontSize: 14,
  },
  scrollView: {
    flex: 1,
    minHeight: '100%',
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 20,
  },
  // Banner - Exact match to detail page
  bannerContainer: {
    width: '100%',
    height: width * 0.8,
    marginTop: 0, // Adjusted since header is inside ScrollView
    position: 'relative',
  },
  imageScroll: {
    width: '100%',
    height: '100%',
  },
  bannerImage: {
    width,
    height: width * 0.8,
  },
  topGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 180,
    zIndex: 1,
  },
  bottomGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 60,
  },
  // Title Section - Exact match to detail page
  titleSection: {
    padding: 20,
    paddingBottom: 16,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 16,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  categoryContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 4,
  },
  categoryName: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.light.primary,
    backgroundColor: Colors.light.primary + '10',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  subcategoryName: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.light.textSecondary,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
  titleContainer: {
    flex: 1,
    marginRight: 12,
    justifyContent: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.light.text,
    alignSelf: 'flex-start',
  },
  priceSection: {
    marginTop: 14,
  },
  locationContainer: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 20,
    gap: 12,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  locationSectionText: {
    fontSize: 13,
    color: Colors.light.text,
    lineHeight: 18,
    flex: 1,
    fontWeight: '500',
  },
  mapContainer: {
    borderRadius: 8,
    overflow: 'hidden',
    marginTop: 4,
    backgroundColor: '#E9ECEF',
    height: 150,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mapPlaceholder: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    textAlign: 'center',
  },
  favoriteButton: {
    padding: 8,
    borderRadius: 24,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  readonlyFavoriteButton: {
    padding: 8,
    borderRadius: 24,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    pointerEvents: 'none', // Explicitly disable clicks
  },
  readonlyButton: {
    flex: 1,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.light.primary,
    backgroundColor: 'transparent',
    pointerEvents: 'none', // Explicitly disable clicks
  },
  readonlyShareButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: Colors.light.border,
    backgroundColor: Colors.light.card,
    justifyContent: 'center',
    alignItems: 'center',
    pointerEvents: 'none', // Explicitly disable clicks
  },
  readonlyText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.primary,
  },
  readonlyBookingText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  readonlyGradient: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 25,
    opacity: 1,
    pointerEvents: 'none', // Explicitly disable clicks
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  location: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    marginLeft: 4,
  },
  posted: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    marginLeft: 8,
  },
  price: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.light.primary,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  discountPrice: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.light.primary,
  },
  originalPrice: {
    fontSize: 20,
    fontWeight: '500',
    color: Colors.light.textSecondary,
    textDecorationLine: 'line-through',
  },
  // Ad Type Badge
  adTypeRow: {
    marginBottom: 8,
  },
  // Action Buttons - Exact match to detail page
  actionSection: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 12,
  },
  
  // WhatsApp Button - Outline Style
  whatsappButton: {
    flex: 1,
    height: 50,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: Colors.light.primary,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  whatsappText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.primary,
  },
  
  // Book Now Button - Solid Gradient Style
  bookingButton: {
    flex: 1,
    height: 50,
    borderRadius: 25,
    overflow: 'hidden',
  },
  bookingGradient: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bookingText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  // Sections - Exact match to detail page
  section: {
    paddingTop: 20,
    paddingBottom: 10,
  },
  sectionContent: {
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    marginBottom: 16,
    color: '#333333',
  },
  seeAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  seeAllText: {
    fontSize: 14,
    color: Colors.light.primary,
    fontWeight: '500',
  },
  // Booking Slots
  slotsContainer: {
    paddingHorizontal: 20,
  },
  slotDayGroup: {
    marginBottom: 16,
  },
  slotDayLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 8,
  },
  slotTimesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  slotChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.light.border,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    gap: 4,
  },
  slotTimeText: {
    fontSize: 13,
    color: Colors.light.text,
    fontWeight: '500',
  },
  // Publisher Section
  publisherCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 20,
    borderWidth: 1,
    borderColor: Colors.light.backgroundSecondary,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  // Posting Terms Section
  postingTermsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 20,
    borderWidth: 1,
    borderColor: Colors.light.backgroundSecondary,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  postingTermRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  postingTermIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.light.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  postingTermContent: {
    flex: 1,
  },
  postingTermLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 2,
  },
  postingTermValue: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    lineHeight: 18,
  },
  postingTermDivider: {
    height: 1,
    backgroundColor: Colors.light.backgroundSecondary,
    marginVertical: 12,
  },
  publisherHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  publisherAvatarContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.light.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: Colors.light.backgroundSecondary,
  },
  publisherAvatar: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  publisherAvatarImage: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  publisherInfo: {
    flex: 1,
  },
  publisherName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
  },
  publisherStats: {
    marginTop: 2,
  },
  publisherStatText: {
    fontSize: 12,
    color: Colors.light.textSecondary,
  },
  publisherContactSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
  },
  contactNumberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  contactNumberText: {
    fontSize: 14,
    color: Colors.light.text,
    lineHeight: 20,
  },
  revealText: {
    fontSize: 13,
    color: Colors.light.primary,
    fontWeight: '500',
  },
  contactNumberRevealed: {
    fontSize: 14,
    color: Colors.light.text,
    fontWeight: '600',
    lineHeight: 20,
  },
  callText: {
    fontSize: 13,
    color: Colors.light.primary,
    fontWeight: '500',
  },
  chatIconButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: Colors.light.background,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.light.primary,
  },
  chatIconText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.primary,
  },
  // Description - Exact match to detail page
  descriptionContainer: {
    paddingHorizontal: 20,
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
    color: Colors.light.text,
  },
  previewConfirmation: {
    backgroundColor: '#F0F8FF',
    padding: 16,
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 24,
    borderRadius: 12,
  },
  previewConfirmationText: {
    fontSize: 14,
    color: Colors.light.text,
    textAlign: 'center',
    lineHeight: 20,
  },
  submitContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    backgroundColor: '#FFFFFF',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  submitButton: {
    marginBottom: 20,
  },
  submitContainerInline: {
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  submitButtonInline: {
    marginBottom: 0,
  },
  // Modal styles
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.light.text,
  },
  placeholder: {
    width: 32,
  },
  paymentSummaryCard: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 20,
    gap: 12,
  },
  paymentSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  paymentSummaryLabel: {
    fontSize: 14,
    color: Colors.light.textSecondary,
  },
  paymentSummaryValue: {
    fontSize: 14,
    color: Colors.light.text,
    fontWeight: '500',
  },
  paymentSummaryTotal: {
    borderTopWidth: 1,
    borderTopColor: '#E9ECEF',
    paddingTop: 12,
    marginTop: 8,
  },
  paymentSummaryTotalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
  },
  paymentSummaryTotalValue: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.light.primary,
  },
  paymentMethodCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  paymentMethodCardSelected: {
    borderColor: Colors.light.primary,
    backgroundColor: '#F0F8FF',
  },
  paymentMethodContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  paymentMethodInfo: {
    flex: 1,
  },
  paymentMethodName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 4,
  },
  paymentMethodDesc: {
    fontSize: 13,
    color: Colors.light.textSecondary,
  },
  paymentRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#E9ECEF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  paymentRadioSelected: {
    borderColor: Colors.light.primary,
  },
  paymentRadioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.light.primary,
  },
  modalActions: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    gap: 12,
    backgroundColor: '#FFFFFF',
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: Colors.light.primary,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 16,
    color: Colors.light.primary,
    fontWeight: '600',
  },
  paymentSubmitButton: {
    flex: 1,
  },
});

// Desktop Styles - Exact match to detail page
const desktopStyles = StyleSheet.create<any>({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 32,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    backgroundColor: '#FFFFFF',
  },
  content: {
    maxWidth: 1000,
    width: '100%',
    marginHorizontal: 'auto',
    padding: 32,
    paddingBottom: 0,
  },
  mainContent: {
    flexDirection: 'row',
    gap: 32,
    marginBottom: 32,
  },
  // Left Column
  leftColumn: {
    width: '50%',
    flexDirection: 'column',
  },
  // Image Section
  imageSection: {
    position: 'relative',
  },
  imageScroll: {
    width: '100%',
    height: 400,
    borderRadius: 16,
    overflow: 'hidden',
  },
  bannerImage: {
    width: 600,
    height: 400,
  },
  // Description Section (under images)
  descriptionSection: {
    marginTop: 24,
  },
  // Content Section
  contentSection: {
    width: '50%',
    flex: 1,
  },
  headerSection: {
    marginBottom: 24,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  categoryContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 6,
  },
  categoryName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.primary,
    backgroundColor: Colors.light.primary + '10',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  subcategoryName: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.light.textSecondary,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  titleContainer: {
    flex: 1,
    marginRight: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.light.text,
    marginBottom: 8,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  location: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    marginLeft: 4,
  },
  posted: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    marginLeft: 8,
  },
  favoriteButton: {
    padding: 12,
    borderRadius: 24,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  discountPrice: {
    fontSize: 32,
    fontWeight: '700',
    color: Colors.light.primary,
  },
  originalPrice: {
    fontSize: 20,
    fontWeight: '500',
    color: Colors.light.textSecondary,
    textDecorationLine: 'line-through',
  },
  // Action Buttons
  actionSection: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 32,
  },
  shareButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: Colors.light.border,
    backgroundColor: Colors.light.card,
    justifyContent: 'center',
    alignItems: 'center',
  },
  whatsappButton: {
    flex: 1,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: Colors.light.primary,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  whatsappText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.primary,
  },
  bookingButton: {
    flex: 1,
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
  },
  bookingGradient: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bookingText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  readonlyShareButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: Colors.light.border,
    backgroundColor: Colors.light.card,
    justifyContent: 'center',
    alignItems: 'center',
    pointerEvents: 'none',
  },
  readonlyFavoriteButton: {
    padding: 12,
    borderRadius: 24,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    pointerEvents: 'none', // Explicitly disable clicks
  },
  readonlyButton: {
    flex: 1,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.light.primary,
    backgroundColor: 'transparent',
    pointerEvents: 'none', // Explicitly disable clicks
    maxWidth: 300, // Limit button width when only one shows
  },
  readonlyText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.primary,
  },
  readonlyBookingText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  readonlyGradient: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 28,
    opacity: 1,
    pointerEvents: 'none', // Explicitly disable clicks
  },
  // Sections
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 16,
  },
  // Booking Slots (Desktop)
  slotsContainer: {
    marginTop: 8,
  },
  slotDayGroup: {
    marginBottom: 20,
  },
  slotDayLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 10,
  },
  slotTimesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  slotChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.light.border,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
    gap: 6,
  },
  slotTimeText: {
    fontSize: 14,
    color: Colors.light.text,
    fontWeight: '500',
  },
  // Location Section
  locationContainer: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E9ECEF',
    gap: 16,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  locationSectionText: {
    fontSize: 14,
    color: Colors.light.text,
    lineHeight: 20,
    flex: 1,
    fontWeight: '500',
  },
  mapContainer: {
    borderRadius: 10,
    overflow: 'hidden',
    marginTop: 8,
    backgroundColor: '#E9ECEF',
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mapPlaceholder: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    textAlign: 'center',
  },
  // Ad Type Badge
  adTypeRow: {
    marginBottom: 12,
  },
  // Publisher Section
  publisherCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E9ECEF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  // Posting Terms Section
  postingTermsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E9ECEF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  postingTermRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  postingTermIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F8F9FA',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  postingTermContent: {
    flex: 1,
  },
  postingTermLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 4,
  },
  postingTermValue: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    lineHeight: 20,
  },
  postingTermDivider: {
    height: 1,
    backgroundColor: '#E9ECEF',
    marginVertical: 16,
  },
  publisherHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  publisherAvatarContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.light.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  publisherAvatar: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  publisherAvatarImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  publisherInfo: {
    flex: 1,
  },
  publisherName: {
    fontSize: 17,
    fontWeight: '600',
    color: Colors.light.text,
  },
  publisherStats: {
    marginTop: 4,
  },
  publisherStatText: {
    fontSize: 14,
    color: Colors.light.textSecondary,
  },
  publisherContactSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
  },
  contactNumberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  contactNumberText: {
    fontSize: 15,
    color: Colors.light.text,
    lineHeight: 20,
  },
  revealText: {
    fontSize: 13,
    color: Colors.light.primary,
    fontWeight: '500',
  },
  contactNumberRevealed: {
    fontSize: 15,
    color: Colors.light.text,
    fontWeight: '600',
    lineHeight: 20,
  },
  callText: {
    fontSize: 13,
    color: Colors.light.primary,
    fontWeight: '500',
  },
  chatIconButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: Colors.light.background,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.light.primary,
  },
  chatIconText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.primary,
  },
  // Description
  descriptionContainer: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  description: {
    fontSize: 15,
    lineHeight: 24,
    color: Colors.light.text,
  },
  // Preview Confirmation
  previewConfirmation: {
    backgroundColor: '#F0F8FF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 32,
    borderWidth: 1,
    borderColor: '#E3F2FD',
  },
  previewConfirmationText: {
    fontSize: 14,
    color: Colors.light.text,
    textAlign: 'center',
    lineHeight: 20,
  },
  // Subscription Info
  subscriptionInfo: {
    marginHorizontal: 0,
  },
  // Submit Button
  submitContainer: {
    borderTopWidth: 1,
    borderTopColor: '#E9ECEF',
    paddingTop: 32,
    alignItems: 'center',
  },
  submitButton: {
    width: 300,
  },
  submitContainerInline: {
    marginTop: 16,
    marginBottom: 32,
  },
  submitButtonInline: {
    width: '100%',
    height: 56,
  },
});