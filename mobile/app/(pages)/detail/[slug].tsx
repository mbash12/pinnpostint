import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Dimensions, Linking, ScrollView, StyleSheet, View, ActivityIndicator, Share, Platform, Pressable } from 'react-native';
import { RenderHTML } from 'react-native-render-html';
import { NetworkImage } from '@/components/ui/network-image';
import { useAlert } from '@/components/ui/custom-alert';
import { ImageCarousel } from '@/components/ui/image-carousel';
import { AdCard } from '@/components/ad-card';
import { Header } from '@/components/header';
import { Footer } from '@/components/footer';
import { MobilePlatformBanners } from '@/components/mobile-platform-banners';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { AdNotFound404 } from '@/components/ui/ad-not-found-404';
import { PriceDisplay } from '@/components/shared/price-display';
import { ActionButtons } from '@/components/shared/action-buttons';
import { AttributesList } from '@/components/shared/attributes-list';
import { GoogleAdMap } from '@/components/ui/google-ad-map';
import { ShareOptions } from '@/components/shared/share-options';
import { Colors } from '@/constants/theme';
import { HEADER_HEIGHT } from '@/constants/layout';
import { getAdStatusConfig } from '@/constants/status-config';
import { formatPrice, shouldHidePrice } from '@/utils/price-formatter';
import { getDaysRemaining } from '@/utils/date-utils';
import { getAdPlaceholder } from '@/constants/placeholders';
import { useResponsive } from '@/hooks/use-responsive';
import { useFavoriteToggle } from '@/hooks/use-favorite-toggle';
import { adsService, userService, platformAdsService, apiService, ShareService } from '@/services';
import { useAuthGuard } from '@/utils/auth-guard';
import { useAuth } from '@/contexts/auth-context';
import { SideBanners } from '@/components/home/side-banners';
import { PlatformAd, PlatformAdPosition } from '@/types/api.types';
import type { Ad } from '@/types/api.types';

const { width } = Dimensions.get('window');

// Helper function to get attachments
function getAttachments(ad: Ad | null) {
  if (!ad) return [];
  const attachments = [];

  if (ad.attachment && Array.isArray(ad.attachment)) {
    ad.attachment.forEach((url, index) => {
      attachments.push({
        icon: 'description',
        label: ad.attachment!.length > 1 ? `Attachment ${index + 1}` : 'Attachment',
        value: url,
        type: 'file'
      });
    });
  }

  return attachments;
}

function mapAttributes(ad: Ad | null, includeCategories = true) {
  if (!ad) return [];
  const attrs = [];
  if (includeCategories) {
    if (ad.category?.name) attrs.push({ icon: 'category', value: ad.category.name });
    if (ad.subcategory?.name) attrs.push({ icon: 'subtitles', value: ad.subcategory.name });
  }
  if (ad.attributes && Array.isArray(ad.attributes)) {
    for (const a of ad.attributes) {
      const label = a.attribute?.name || '';
      const value = a.value || '';
      const type = (a.attribute as any)?.type || '';

      if ((label || value) && type !== 'file') {
        attrs.push({ icon: 'label', value: `${label}: ${value}` });
      }
    }
  }
  return attrs;
}

// Helper function to get user-friendly status label
function getStatusLabel(status: string): string {
  switch (status) {
    case 'APPROVED':
      return 'Active';
    case 'REVIEW':
      return 'In Review';
    case 'REJECTED':
      return 'Rejected';
    case 'EXPIRED':
      return 'Expired';
    case 'UNPUBLISHED':
      return 'Unpublished';
    default:
      return status;
  }
}

// Helper to get short location (City, State)
function getAdShortLocation(ad: Ad | null): string {
  if (!ad) return '';
  if (ad.locationCity) {
    if (ad.locationState) return `${ad.locationCity}, ${ad.locationState}`;
    return ad.locationCity;
  }
  return 'Location';
}

// Helper to get full location
function getAdFullLocation(ad: Ad | null): string {
  if (!ad) return '';
  return ad.locationFormatted || getAdShortLocation(ad);
}

// Legacy helper for related ads which might still use this
function getAdLocation(ad: Ad | null): string {
  return getAdFullLocation(ad);
}

export default function DetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isFavorite, setIsFavorite] = useState(false);
  const [showFullAddress, setShowFullAddress] = useState(false);
  const { isDesktop, screenWidth } = useResponsive();
  const [ad, setAd] = useState<Ad | null>(null);
  const [related, setRelated] = useState<Ad[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const { showAlert } = useAlert();
  const { user, isAuthenticated } = useAuth();
  const { toggleFavorite } = useFavoriteToggle();
  const [platformAds, setPlatformAds] = useState<PlatformAd[]>([]);
  const [isLoadingPlatformAds, setIsLoadingPlatformAds] = useState(true);
  const [phoneRevealed, setPhoneRevealed] = useState(false);
  const [publisherStats, setPublisherStats] = useState<{ activeAds: number; memberSince: string } | null>(null);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [isNotifying, setIsNotifying] = useState(false);
  const [hasNotifiedOnOpen, setHasNotifiedOnOpen] = useState(false);

  useEffect(() => {
    fetchPlatformAds();
  }, []);

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

  // Determine if ad is expired based on date
  const daysLeft = ad?.expiresAt ? getDaysRemaining(ad.expiresAt) : 1;
  const isExpiredByDate = ad?.expiresAt ? daysLeft < 0 : false;

  // Effective status for UI display
  const effectiveStatus = (ad?.status === 'APPROVED' && isExpiredByDate) ? 'EXPIRED' : (ad?.status || '');

  useEffect(() => {
    const slug = params.slug as string;
    if (!slug) return;
    // Wait for auth state to be determined before fetching
    fetchAd(slug);
  }, [params.slug, isAuthenticated]);

  // Auto-notify seller when user opens an expired ad
  useEffect(() => {
    if (ad && effectiveStatus === 'EXPIRED' && !hasNotifiedOnOpen) {
      setHasNotifiedOnOpen(true);
      adsService.notifyRenewalInterest(ad.id).catch(() => {
        // Silently fail - notification is best-effort
      });
    }
  }, [ad, effectiveStatus, hasNotifiedOnOpen]);

  const fetchAd = async (slug: string) => {
    try {
      setLoading(true);
      setNotFound(false);

      // First try to fetch as public ad (for approved ads)
      const response = await adsService.getPublicAd(slug);
      if (response.success && response.data) {
        setAd(response.data);
        setIsFavorite(response.data.isFavorite || false);
        fetchRelated(response.data);
        // Fetch publisher stats
        if (response.data.user?.id) {
          fetchPublisherStats(response.data.user.id);
        }
        // Record view
        adsService.recordView(response.data.id).catch(() => { });
        return;
      }
    } catch (e: any) {
      // If public ad fetch fails, try user's own ad if authenticated
      if (isAuthenticated && user) {
        try {
          const myAdResponse = await adsService.getMyAd(slug);
          if (myAdResponse.success && myAdResponse.data) {
            setAd(myAdResponse.data);
            setIsFavorite(myAdResponse.data.isFavorite || false);
            // Fetch publisher stats
            if (myAdResponse.data.user?.id) {
              fetchPublisherStats(myAdResponse.data.user.id);
            }
            // Don't fetch related for non-approved ads
            setRelated([]);
            return;
          }
        } catch (myAdError) {
        }
      }
    } finally {
      setLoading(false);
    }
    setNotFound(true);
  };

  const fetchRelated = async (current: Ad) => {
    try {
      const resp = await adsService.getPublicAds({
        page: 1,
        limit: 8,
        subcategoryId: current.subcategoryId || undefined,
        sortBy: "createdAt",
        sortOrder: "desc"
      });
      if (resp.success && resp.data) {
        const others = (resp.data || []).filter(a => a.id !== current.id);
        setRelated(others);
      }
    } catch (e) {
    }
  };

  // Helper function to censor phone number
  const censorPhoneNumber = (phone: string): string => {
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 0) return phone;

    // Replace all digits with asterisks
    const censored = phone.replace(/\d/g, '*');
    return censored;
  };

  // Fetch publisher stats
  const fetchPublisherStats = async (userId: string) => {
    try {
      // Use the new efficient endpoint to get publisher stats
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
      // Silently fail if stats can't be fetched
      setPublisherStats({ activeAds: 0, memberSince: '' });
    }
  };

  const handleExpiredContact = async () => {
    if (!ad || isNotifying) return;
    setIsNotifying(true);
    showAlert({
      title: 'Ad Expired',
      message: 'This ad has expired. The seller has been notified that someone is interested. Renewing the ad will restore contact access.',
      type: 'info'
    });
    try {
      await adsService.notifyRenewalInterest(ad.id);
    } catch (e) {
      // Silently fail - notification is best-effort
    } finally {
      setIsNotifying(false);
    }
  };

  const handleWhatsApp = () => {
    // Check authentication before allowing WhatsApp contact
    if (!isAuthenticated) {
      if (isDesktop) {
        // Show login modal on desktop
        setLoginModalVisible(true);
      } else {
        // Redirect to login on mobile
        checkAuthAndRedirect();
      }
      return;
    }

    if (!ad) return;

    // If ad is expired, notify seller instead of opening WhatsApp
    if (effectiveStatus === 'EXPIRED') {
      handleExpiredContact();
      return;
    }

    const shareUrl = Platform.OS === 'web'
      ? `${window.location.origin}/detail/${ad.slug || ad.id}`
      : `https://pinnpost.com/detail/${ad.slug || ad.id}`;

    const message = `Hi, I'm interested in your ad: ${ad.title || ''}\n\nLink: ${shareUrl}`;
    const phoneNumber = ad.user?.phone || '';

    // Clean phone number (remove +, spaces, etc. for wa.me)
    const cleanPhone = phoneNumber.replace(/[^0-9]/g, '');
    // Add India country code if not present (numbers should be 10 digits without 0 or country code)
    const phoneWithCountryCode = cleanPhone.startsWith('91') ? cleanPhone : `91${cleanPhone.replace(/^0/, '')}`;
    const webUrl = `https://wa.me/${phoneWithCountryCode}?text=${encodeURIComponent(message)}`;
    const deepLink = `whatsapp://send?phone=${phoneWithCountryCode}&text=${encodeURIComponent(message)}`;

    if (Platform.OS === 'web') {
      window.open(webUrl, '_blank');
    } else {
      // Try direct app deep link first
      Linking.openURL(deepLink).catch(() => {
        // Fallback to wa.me browser link if deep link fails
        Linking.openURL(webUrl).catch(() => {
          showAlert({
            title: "Error",
            message: "Unable to open WhatsApp. Please make sure it's installed.",
            type: "error"
          });
        });
      });
    }
  };

  const handleShare = async () => {
    // Check authentication before allowing share
    if (!isAuthenticated) {
      if (isDesktop) {
        // Show login modal on desktop
        setLoginModalVisible(true);
      } else {
        // Redirect to login on mobile
        checkAuthAndRedirect();
      }
      return;
    }
    setShowShareMenu(true);
  };

  const handleShareOption = async (option: string) => {
    if (!ad) return;
    setShowShareMenu(false);

    const shareUrl = Platform.OS === 'web'
      ? `${window.location.origin}/detail/${ad.slug || ad.id}`
      : `https://pinnpost.com/detail/${ad.slug || ad.id}`;

    const shareContent = {
      title: ad.title,
      message: `${ad.title}\n\n${ad.description}\n\nPrice: ₹${ad.price}`,
      url: shareUrl,
    };

    try {
      switch (option) {
        case 'native':
          await ShareService.share(shareContent);
          break;
        case 'whatsapp':
          const phoneNumber = ad.user?.phone || '';
          await ShareService.shareViaWhatsApp(shareContent, phoneNumber);
          break;
        case 'email':
          await ShareService.shareViaEmail(shareContent);
          break;
        case 'copy':
          if (Platform.OS === 'web') {
            await navigator.clipboard.writeText(shareUrl);
            showAlert({ title: 'Copied!', message: 'Link copied to clipboard', type: 'success' });
          } else {
            await ShareService.share({ ...shareContent, message: shareUrl });
          }
          break;
      }

      await adsService.recordShare(ad.id);
    } catch (e: any) {
      if (e.message !== 'Share canceled' && e.message !== 'Share dismissed') {
      }
    }
  };

  const { checkAuthAndRedirect } = useAuthGuard();
  const { setLoginModalVisible } = useAuth();

  const handleBooking = () => {
    // Check authentication before proceeding with booking
    if (!checkAuthAndRedirect()) {
      return; // Will redirect to login if not authenticated
    }

    if (!ad?.slug) {
      showAlert({
        title: 'Error',
        message: 'Unable to book this ad. Please try again later.',
        type: 'error'
      });
      return;
    }

    // If ad is expired, notify seller instead of booking
    if (effectiveStatus === 'EXPIRED') {
      handleExpiredContact();
      return;
    }

    router.push({
      pathname: "/(pages)/booking",
      params: { adSlug: ad?.slug }
    });
  };

  const handleRelatedAdPress = (adSlug: string) => {
    router.push(`/(pages)/detail/${adSlug}`);
  };

  const handleMainFavorite = async () => {
    if (!ad?.id) return;
    // Check authentication before proceeding with favorite action
    if (!checkAuthAndRedirect()) {
      return; // Will redirect to login if not authenticated
    }

    const originalValue = isFavorite;
    setIsFavorite(!originalValue); // Optimistic update

    try {
      if (originalValue) {
        await userService.removeFromWishlist(ad.id);
      } else {
        await userService.addToWishlist(ad.id);
      }
    } catch (error) {
      setIsFavorite(originalValue); // Revert
    }
  };

  const handleRelatedFavorite = async (adId: string) => {
    const relatedAd = related.find(a => String(a.id) === String(adId));
    if (!relatedAd) return;
    const wasFavorite = relatedAd.isFavorite ?? false;

    // Optimistic update
    setRelated(prev => prev.map(a =>
      String(a.id) === String(adId) ? { ...a, isFavorite: !wasFavorite } : a
    ));

    const success = await toggleFavorite(adId, wasFavorite);
    if (!success) {
      // Revert
      setRelated(prev => prev.map(a =>
        String(a.id) === String(adId) ? { ...a, isFavorite: wasFavorite } : a
      ));
    }
  };

  if (loading) {
    return (
      <ThemedView style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={Colors.light.primary} />
      </ThemedView>
    );
  }

  if (notFound) {
    return (
      <View style={{ flex: 1 }}>
        {isDesktop ? null : <Header />}
        <AdNotFound404 />
        <Footer />
      </View>
    );
  }

  const hasNoImages = !ad?.images || ad.images.length === 0;

  // Get standardized placeholder for jobs/services if no images provided
  const adPlaceholder = getAdPlaceholder(ad?.category?.name, ad?.subcategory?.name, ad?.category?.adPlaceholder);

  // Mobile View
  const mobileView = (
    <>
      <Header />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Immersive Banner */}
        <ThemedView style={styles.bannerContainer}>
          <ImageCarousel
            images={hasNoImages && adPlaceholder ? [adPlaceholder] : (ad?.images || [])}
            imageWidth={width}
            imageHeight={width * 0.8}
            onIndexChange={setCurrentImageIndex}
          />
          <LinearGradient
            colors={['rgba(255, 255, 255, 0.85)', 'transparent']}
            style={styles.topGradient}
            pointerEvents="none"
          />
          <LinearGradient
            colors={['transparent', 'rgba(255, 255, 255, 0.9)']}
            style={styles.bottomGradient}
            pointerEvents="none"
          />
        </ThemedView>

        {/* Title and Location */}
        <ThemedView style={styles.titleSection}>
          <ThemedView >
            {effectiveStatus !== '' && effectiveStatus !== 'APPROVED' && (effectiveStatus !== 'EXPIRED' || (isAuthenticated && user?.id === ad?.userId)) && (
              <View style={[styles.statusBadge, { backgroundColor: getAdStatusConfig(effectiveStatus).backgroundColor }]}>
                <MaterialIcons name={getAdStatusConfig(effectiveStatus).icon} size={12} color={getAdStatusConfig(effectiveStatus).textColor} />
                <ThemedText style={[styles.statusText, { color: getAdStatusConfig(effectiveStatus).textColor }]}>{getStatusLabel(effectiveStatus)}</ThemedText>
              </View>
            )}
          </ThemedView>

          {/* Dedicated Category and Subcategory */}
          {ad?.category?.name && (
            <View style={styles.categoryContainer}>
              <ThemedText style={styles.categoryName}>{ad.category.name}</ThemedText>
              {ad?.subcategory?.name && (
                <>
                  <MaterialIcons name="chevron-right" size={14} color={Colors.light.textSecondary} />
                  <ThemedText style={styles.subcategoryName}>{ad.subcategory.name}</ThemedText>
                </>
              )}
            </View>
          )}

          <ThemedView style={styles.titleRow}>
            <ThemedView style={styles.titleContainer}>
              <ThemedText type="subtitle" style={styles.title}>{ad?.title || ''}</ThemedText>
            </ThemedView>
            <Pressable
              style={styles.favoriteButton}
              onPress={handleMainFavorite}
            >
              <MaterialIcons
                name={isFavorite ? "favorite" : "favorite-border"}
                size={28}
                color={isFavorite ? Colors.light.primary : Colors.light.textSecondary}
              />
            </Pressable>
          </ThemedView>
          {(!shouldHidePrice(ad?.price) || !shouldHidePrice(ad?.discountedPrice)) && (
            <ThemedView style={styles.priceSection}>
              <PriceDisplay
                price={ad?.price ?? null}
                discountPrice={ad?.discountedPrice ?? null}
                size="small"
              />
            </ThemedView>
          )}
        </ThemedView>

        {/* Action Buttons - Only show share for approved ads, hide WhatsApp for expired */}
        <ThemedView style={styles.actionSection}>
          {effectiveStatus === 'APPROVED' && (
            <Pressable
              style={styles.shareButton}
              onPress={handleShare}
            >
              <MaterialIcons name="share" size={20} color={Colors.light.textSecondary} />
            </Pressable>
          )}

          {effectiveStatus !== 'EXPIRED' && (
            <Pressable
              style={[styles.whatsappButton, effectiveStatus !== 'APPROVED' && { flex: 1 }]}
              onPress={handleWhatsApp}
            >
              <ThemedText style={styles.whatsappText}>WhatsApp</ThemedText>
            </Pressable>
          )}

          {ad?.enableBooking && effectiveStatus === 'APPROVED' && (
            <Pressable
              style={styles.bookingButton}
              onPress={handleBooking}
            >
              <LinearGradient
                colors={[Colors.light.gradientStart, Colors.light.gradientEnd]}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={styles.bookingGradient}
              >
                <ThemedText style={styles.bookingText}>Book Now</ThemedText>
              </LinearGradient>
            </Pressable>
          )}
        </ThemedView>

        {/* Description */}
        <ThemedView style={styles.section}>
          <ThemedView style={styles.sectionContent}>
            <ThemedText type="subtitle" style={styles.sectionTitle}>Description</ThemedText>
          </ThemedView>
          <ThemedView style={styles.descriptionContainer}>
            {ad?.description ? (
              <RenderHTML
                contentWidth={width - 40}
                source={{ html: ad.description }}
                baseStyle={styles.description}
              />
            ) : (
              <ThemedText style={styles.description}>No description available.</ThemedText>
            )}
          </ThemedView>
        </ThemedView>

        <MobilePlatformBanners ads={platformAds} position="top" />

        {/* Attributes */}
        <ThemedView style={styles.section}>
          <ThemedView style={styles.sectionContent}>
            <ThemedText type="subtitle" style={styles.sectionTitle}>Details</ThemedText>
          </ThemedView>
          <AttributesList
            attributes={mapAttributes(ad, false)}
          />
        </ThemedView>

        {/* Appointment Slots */}
        {ad?.enableBooking && ad?.bookingType === 'SLOTS' && ad?.slots && ad.slots.length > 0 && (
          <ThemedView style={styles.section}>
            <ThemedView style={styles.sectionContent}>
              <ThemedText type="subtitle" style={styles.sectionTitle}>Appointment Slots</ThemedText>
            </ThemedView>
            <View style={styles.slotsContainer}>
              {(() => {
                const slotsByDate: Record<string, typeof ad.slots> = {};
                ad.slots.forEach((slot: any) => {
                  const dateKey = slot.date?.split('T')[0] || slot.date;
                  if (!slotsByDate[dateKey]) {
                    slotsByDate[dateKey] = [];
                  }
                  slotsByDate[dateKey].push(slot);
                });
                return Object.entries(slotsByDate).map(([date, dateSlots]) => (
                  <View key={date} style={styles.slotDayGroup}>
                    <ThemedText style={styles.slotDayLabel}>{date}</ThemedText>
                    <View style={styles.slotTimesContainer}>
                      {dateSlots.map((slot: any, idx: number) => {
                        const max = slot.maxBookings || 1;
                        const booked = slot.bookedCount ?? 0;
                        const isFull = booked >= max;
                        return (
                          <View key={idx} style={[styles.slotChip, isFull && styles.slotChipFull]}>
                            <MaterialIcons name={isFull ? 'block' : 'access-time'} size={14} color={isFull ? '#CCC' : Colors.light.textSecondary} />
                            <ThemedText style={[styles.slotTimeText, isFull && styles.slotTimeTextFull]}>
                              {slot.startTime} - {slot.endTime}
                              {isFull ? ' (Full)' : booked > 0 ? ` (${max - booked} left)` : ''}
                            </ThemedText>
                          </View>
                        );
                      })}
                    </View>
                  </View>
                ));
              })()}
            </View>
          </ThemedView>
        )}

        {/* Attachments */}
        {getAttachments(ad).length > 0 && (
          <ThemedView style={styles.section}>
            <ThemedView style={styles.sectionContent}>
              <ThemedText type="subtitle" style={styles.sectionTitle}>Attachments</ThemedText>
            </ThemedView>
            <AttributesList
              attributes={getAttachments(ad)}
            />
          </ThemedView>
        )}

        {/* Publisher Section */}
        {ad?.user && (
          <ThemedView style={styles.section}>
            <ThemedView style={styles.sectionContent}>
              <ThemedText type="subtitle" style={styles.sectionTitle}>Publisher</ThemedText>
            </ThemedView>
            <View style={styles.publisherCard}>
              <Pressable
                onPress={() => {
                  // Check authentication before allowing publisher profile access
                  if (!isAuthenticated) {
                    setLoginModalVisible(true);
                    return;
                  }
                  // Navigate to publisher profile if authenticated
                  if (ad?.user) {
                    router.push(`/(pages)/user/${ad.user.id}`);
                  }
                }}
              >
                <View style={styles.publisherHeader}>
                  <View style={styles.publisherAvatarContainer}>
                    {ad.user?.avatar ? (
                      <NetworkImage
                        source={{ uri: ad.user?.avatar }}
                        style={styles.publisherAvatarImage}
                        resizeMode="cover"
                      />
                    ) : (
                      <ThemedText style={styles.publisherAvatar}>
                        {ad.user?.firstName.charAt(0).toUpperCase()}
                      </ThemedText>
                    )}
                  </View>
                  <View style={styles.publisherInfo}>
                    <ThemedText style={styles.publisherName}>
                      {ad.user?.firstName} {ad.user?.lastName || ''}
                    </ThemedText>
                    {publisherStats && publisherStats.memberSince && (
                      <View style={styles.publisherStats}>
                        <ThemedText style={styles.publisherStatText}>
                          {publisherStats.memberSince}
                        </ThemedText>
                      </View>
                    )}
                  </View>
                  <MaterialIcons name="chevron-right" size={24} color={Colors.light.textSecondary} />
                </View>
              </Pressable>

              {/* Contact Actions - Show for non-expired, or for expired when logged in */}
              {(effectiveStatus !== 'EXPIRED' || isAuthenticated) && (
                <View style={styles.publisherContactSection}>
                  {/* Contact Number */}
                  {(ad.user?.phone || !isAuthenticated) && (
                    <View style={styles.contactNumberRow}>
                      <MaterialIcons name="phone" size={18} color={Colors.light.textSecondary} />
                      {!isAuthenticated ? (
                        <Pressable
                          onPress={() => {
                            setLoginModalVisible(true);
                          }}
                        >
                          <ThemedText style={styles.contactNumberText}>
                            {censorPhoneNumber(ad.user?.phone || '** *** ****')} <ThemedText style={styles.revealText}>Tap to reveal</ThemedText>
                          </ThemedText>
                        </Pressable>
                      ) : !phoneRevealed ? (
                        <Pressable onPress={() => setPhoneRevealed(true)}>
                          <ThemedText style={styles.contactNumberText}>
                            {censorPhoneNumber(ad.user.phone)} <ThemedText style={styles.revealText}>Tap to reveal</ThemedText>
                          </ThemedText>
                        </Pressable>
                      ) : (
                        <Pressable
                          onPress={() => {
                            const cleanPhone = ad.user?.phone?.replace(/[^0-9]/g, '') || '';
                            const phoneUrl = `tel:${cleanPhone}`;
                            Linking.openURL(phoneUrl).catch(() => {
                              showAlert({
                                title: "Error",
                                message: "Unable to make a call.",
                                type: "error"
                              });
                            });
                          }}
                        >
                          <ThemedText style={styles.contactNumberRevealed}>
                            {ad.user.phone} <ThemedText style={styles.callText}>Tap to call</ThemedText>
                          </ThemedText>
                        </Pressable>
                      )}
                    </View>
                  )}

                  {/* Chat Button */}
                  <Pressable
                    style={styles.chatIconButton}
                    onPress={() => {
                      if (!isAuthenticated) {
                        setLoginModalVisible(true);
                        return;
                      }
                      if (ad?.slug) {
                        router.push({
                          pathname: '/(pages)/chat',
                          params: {
                            adSlug: ad.slug,
                          }
                        });
                      }
                    }}
                  >
                    <MaterialIcons name="chat-bubble-outline" size={20} color={Colors.light.primary} />
                    <ThemedText style={styles.chatIconText}>Chat</ThemedText>
                  </Pressable>
                </View>
              )}
            </View>
          </ThemedView>
        )}

        {/* Location Section */}
        <ThemedView style={styles.section}>
          <ThemedView style={styles.sectionContent}>
            <ThemedText type="subtitle" style={styles.sectionTitle}>Location</ThemedText>
          </ThemedView>
          <ThemedView style={styles.locationContainer}>
            <View style={styles.addressRow}>
              <MaterialIcons name="location-on" size={18} color={Colors.light.primary} />
              <ThemedText style={styles.locationSectionText}>
                {getAdFullLocation(ad)}
              </ThemedText>
            </View>
            {ad?.locationLatitude && ad?.locationLongitude && (
              <View style={styles.mapContainer}>
                <GoogleAdMap
                  latitude={ad.locationLatitude}
                  longitude={ad.locationLongitude}
                  height={150}
                />
              </View>
            )}
          </ThemedView>
        </ThemedView>

        {/* Related Ads */}
        <ThemedView style={styles.section}>
          <ThemedView style={styles.sectionContent}>
            <ThemedText type="subtitle" style={styles.sectionTitle}>Related Ads</ThemedText>
          </ThemedView>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.relatedContainer}
          >
            {related.map((rad) => (
              <AdCard
                key={rad.id}
                id={String(rad.id)}
                slug={rad.slug}
                title={rad.title}
                description={rad.description}
                location={getAdLocation(rad)}
                price={!shouldHidePrice(rad.price) ? formatPrice(rad.price) : ''}
                discountedPrice={rad.discountedPrice && !shouldHidePrice(rad.discountedPrice) ? formatPrice(rad.discountedPrice) : undefined}
                image={rad.images?.[0]}
                publisherName={rad.user ? `${rad.user.firstName}${rad.user.lastName ? ' ' + rad.user.lastName : ''}` : undefined}
                category={rad.category?.name}
                subcategory={rad.subcategory?.name}
                categoryPlaceholder={rad.category?.adPlaceholder}
                status={rad.status}
                onPress={() => handleRelatedAdPress(rad.slug)}
                onFavorite={handleRelatedFavorite}
                isFavorite={rad.isFavorite || false}
                containerStyle={{
                  width: 160,
                  marginRight: 16
                }}
              />
            ))}
          </ScrollView>
        </ThemedView>
        <MobilePlatformBanners ads={platformAds} position="bottom" style={{ marginTop: 8, marginBottom: 24, paddingHorizontal: 16 }} />
        <Footer />
      </ScrollView>

      <ShareOptions
        visible={showShareMenu}
        onClose={() => setShowShareMenu(false)}
        onOptionPress={handleShareOption}
      />
    </>
  );

  // Desktop View
  const desktopView = (
    <View style={desktopStyles.container}>
      <ScrollView
        style={desktopStyles.scrollView}
        contentContainerStyle={desktopStyles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={isDesktop ? desktopStyles.desktopHomeWrapper : null}>
          {isDesktop && (
            <SideBanners
              ads={platformAds.filter(ad => ad.position === PlatformAdPosition.LEFT)}
              position={PlatformAdPosition.LEFT}
            />
          )}

          <View style={isDesktop ? desktopStyles.desktopMainContent : null}>
            <View style={desktopStyles.content}>
              <View style={desktopStyles.mainContent}>
                {/* Left Column: Images + Description */}
                <View style={desktopStyles.leftColumn}>
                  {/* Image Gallery */}
                  <View style={desktopStyles.imageSection}>
                    <ImageCarousel
                      images={hasNoImages && adPlaceholder ? [adPlaceholder] : (ad?.images || [])}
                      imageWidth={600}
                      imageHeight={400}
                      onIndexChange={setCurrentImageIndex}
                      showThumbnails={!hasNoImages}
                      resizeMode="cover"
                    />
                  </View>

                  {/* Description - Under images */}
                  <View style={desktopStyles.descriptionSection}>
                    <ThemedText style={desktopStyles.sectionTitle}>Description</ThemedText>
                    <View style={desktopStyles.descriptionContainer}>
                      {ad?.description ? (
                        <RenderHTML
                          contentWidth={600}
                          source={{ html: ad.description }}
                          baseStyle={desktopStyles.description}
                        />
                      ) : (
                        <ThemedText style={desktopStyles.description}>No description available.</ThemedText>
                      )}
                    </View>
                  </View>
                </View>

                {/* Right Column: Content */}
                <View style={desktopStyles.contentSection}>
                  {/* Title and Actions */}
                  <View style={desktopStyles.headerSection}>
                    <View style={desktopStyles.adTypeRow}>
                      {effectiveStatus !== '' && effectiveStatus !== 'APPROVED' && (effectiveStatus !== 'EXPIRED' || (isAuthenticated && user?.id === ad?.userId)) && (
                        <View style={[desktopStyles.statusBadge, { backgroundColor: getAdStatusConfig(effectiveStatus).backgroundColor }]}>
                          <MaterialIcons name={getAdStatusConfig(effectiveStatus).icon} size={14} color={getAdStatusConfig(effectiveStatus).textColor} />
                          <ThemedText style={[desktopStyles.statusText, { color: getAdStatusConfig(effectiveStatus).textColor }]}>{getStatusLabel(effectiveStatus)}</ThemedText>
                        </View>
                      )}
                    </View>

                    {/* Dedicated Category and Subcategory */}
                    {ad?.category?.name && (
                      <View style={desktopStyles.categoryContainer}>
                        <ThemedText style={desktopStyles.categoryName}>{ad.category.name}</ThemedText>
                        {ad?.subcategory?.name && (
                          <>
                            <MaterialIcons name="chevron-right" size={16} color={Colors.light.textSecondary} />
                            <ThemedText style={desktopStyles.subcategoryName}>{ad.subcategory.name}</ThemedText>
                          </>
                        )}
                      </View>
                    )}
                    <View style={desktopStyles.titleRow}>
                      <View style={desktopStyles.titleContainer}>
                        <ThemedText style={desktopStyles.title}>{ad?.title || ''}</ThemedText>
                      </View>
                      <Pressable
                        style={desktopStyles.favoriteButton}
                        onPress={handleMainFavorite}
                      >
                        <MaterialIcons
                          name={isFavorite ? "favorite" : "favorite-border"}
                          size={28}
                          color={isFavorite ? Colors.light.primary : Colors.light.textSecondary}
                        />
                      </Pressable>
                    </View>

                    {(!shouldHidePrice(ad?.price) || !shouldHidePrice(ad?.discountedPrice)) && (
                      <View style={desktopStyles.priceRow}>
                        {ad?.discountedPrice && !shouldHidePrice(ad?.discountedPrice) ? (
                          <>
                            <ThemedText style={desktopStyles.discountPrice}>{formatPrice(ad?.discountedPrice)}</ThemedText>
                            {!shouldHidePrice(ad?.price) && (
                              <ThemedText style={desktopStyles.originalPrice}>{formatPrice(ad?.price)}</ThemedText>
                            )}
                          </>
                        ) : !shouldHidePrice(ad?.price) ? (
                          <ThemedText style={desktopStyles.discountPrice}>{formatPrice(ad?.price)}</ThemedText>
                        ) : null}
                      </View>
                    )}
                  </View>

                  {/* Action Buttons - Only show share for approved ads, hide WhatsApp for expired */}
                  <View style={desktopStyles.actionSection}>
                    {effectiveStatus === 'APPROVED' && (
                      <Pressable
                        style={desktopStyles.shareButton}
                        onPress={handleShare}
                      >
                        <MaterialIcons name="share" size={20} color={Colors.light.textSecondary} />
                      </Pressable>
                    )}

                    {effectiveStatus !== 'EXPIRED' && (
                      <Pressable
                        style={[desktopStyles.whatsappButton, effectiveStatus !== 'APPROVED' && { flex: 1 }]}
                        onPress={handleWhatsApp}
                      >
                        <ThemedText style={desktopStyles.whatsappText}>WhatsApp</ThemedText>
                      </Pressable>
                    )}

                    {ad?.enableBooking && effectiveStatus === 'APPROVED' && (
                      <Pressable
                        style={desktopStyles.bookingButton}
                        onPress={handleBooking}
                      >
                        <LinearGradient
                          colors={[Colors.light.gradientStart, Colors.light.gradientEnd]}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 0, y: 1 }}
                          style={desktopStyles.bookingGradient}
                        >
                          <ThemedText style={desktopStyles.bookingText}>Book Now</ThemedText>
                        </LinearGradient>
                      </Pressable>
                    )}
                  </View>


                  {/* Attributes */}
                  <View style={desktopStyles.section}>
                    <ThemedText style={desktopStyles.sectionTitle}>Details</ThemedText>
                    <AttributesList
                      attributes={mapAttributes(ad, false)}
                      isDesktop={true}
                    />
                  </View>

                  {/* Appointment Slots */}
                  {ad?.enableBooking && ad?.bookingType === 'SLOTS' && ad?.slots && ad.slots.length > 0 && (
                    <View style={desktopStyles.section}>
                      <ThemedText style={desktopStyles.sectionTitle}>Appointment Slots</ThemedText>
                      <View style={desktopStyles.slotsContainer}>
                        {(() => {
                          const slotsByDate: Record<string, typeof ad.slots> = {};
                          ad.slots.forEach((slot: any) => {
                            const dateKey = slot.date?.split('T')[0] || slot.date;
                            if (!slotsByDate[dateKey]) {
                              slotsByDate[dateKey] = [];
                            }
                            slotsByDate[dateKey].push(slot);
                          });
                          return Object.entries(slotsByDate).map(([date, dateSlots]) => (
                            <View key={date} style={desktopStyles.slotDayGroup}>
                              <ThemedText style={desktopStyles.slotDayLabel}>{date}</ThemedText>
                              <View style={desktopStyles.slotTimesContainer}>
                                {dateSlots.map((slot: any, idx: number) => {
                                  const max = slot.maxBookings || 1;
                                  const booked = slot.bookedCount ?? 0;
                                  const isFull = booked >= max;
                                  return (
                                    <View key={idx} style={[desktopStyles.slotChip, isFull && desktopStyles.slotChipFull]}>
                                      <MaterialIcons name={isFull ? 'block' : 'access-time'} size={14} color={isFull ? '#CCC' : Colors.light.textSecondary} />
                                      <ThemedText style={[desktopStyles.slotTimeText, isFull && desktopStyles.slotTimeTextFull]}>
                                        {slot.startTime} - {slot.endTime}
                                        {isFull ? ' (Full)' : booked > 0 ? ` (${max - booked} left)` : ''}
                                      </ThemedText>
                                    </View>
                                  );
                                })}
                              </View>
                            </View>
                          ));
                        })()}
                      </View>
                    </View>
                  )}

                  {/* Publisher Section */}
                  {ad?.user && (
                    <View style={desktopStyles.section}>
                      <ThemedText style={desktopStyles.sectionTitle}>Publisher</ThemedText>
                      <View style={desktopStyles.publisherCard}>
                        <Pressable
                          onPress={() => {
                            // Check authentication before allowing publisher profile access
                            if (!isAuthenticated) {
                              // Show login modal on desktop
                              setLoginModalVisible(true);
                              return;
                            }
                            // Navigate to publisher profile if authenticated
                            if (ad?.user) {
                              router.push(`/(pages)/user/${ad.user.id}`);
                            }
                          }}
                        >
                          <View style={desktopStyles.publisherHeader}>
                            <View style={desktopStyles.publisherAvatarContainer}>
                              {ad.user?.avatar ? (
                                <NetworkImage
                                  source={{ uri: ad.user?.avatar }}
                                  style={desktopStyles.publisherAvatarImage}
                                  resizeMode="cover"
                                />
                              ) : (
                                <ThemedText style={desktopStyles.publisherAvatar}>
                                  {ad.user?.firstName.charAt(0).toUpperCase()}
                                </ThemedText>
                              )}
                            </View>
                            <View style={desktopStyles.publisherInfo}>
                              <ThemedText style={desktopStyles.publisherName}>
                                {ad.user?.firstName} {ad.user?.lastName || ''}
                              </ThemedText>
                              {publisherStats && publisherStats.memberSince && (
                                <View style={desktopStyles.publisherStats}>
                                  <ThemedText style={desktopStyles.publisherStatText}>
                                    {publisherStats.memberSince}
                                  </ThemedText>
                                </View>
                              )}
                            </View>
                            <MaterialIcons name="chevron-right" size={24} color={Colors.light.textSecondary} />
                          </View>
                        </Pressable>

                        {/* Contact Actions - Desktop - Show for non-expired, or for expired when logged in */}
                        {(effectiveStatus !== 'EXPIRED' || isAuthenticated) && (
                          <View style={desktopStyles.publisherContactSection}>
                            {/* Contact Number */}
                            {(ad.user?.phone || !isAuthenticated) && (
                              <View style={desktopStyles.contactNumberRow}>
                                <MaterialIcons name="phone" size={18} color={Colors.light.textSecondary} />
                                {!isAuthenticated ? (
                                  <Pressable onPress={() => setLoginModalVisible(true)}>
                                    <ThemedText style={desktopStyles.contactNumberText}>
                                      {censorPhoneNumber(ad.user?.phone || '** *** ****')} <ThemedText style={desktopStyles.revealText}>Tap to reveal</ThemedText>
                                    </ThemedText>
                                  </Pressable>
                                ) : !phoneRevealed ? (
                                  <Pressable onPress={() => setPhoneRevealed(true)}>
                                    <ThemedText style={desktopStyles.contactNumberText}>
                                      {censorPhoneNumber(ad.user.phone)} <ThemedText style={desktopStyles.revealText}>Tap to reveal</ThemedText>
                                    </ThemedText>
                                  </Pressable>
                                ) : (
                                  <Pressable
                                    onPress={() => {
                                      const cleanPhone = ad.user?.phone?.replace(/[^0-9]/g, '') || '';
                                      const phoneUrl = `tel:${cleanPhone}`;
                                      Linking.openURL(phoneUrl).catch(() => {
                                        showAlert({
                                          title: "Error",
                                          message: "Unable to make a call.",
                                          type: "error"
                                        });
                                      });
                                    }}
                                  >
                                    <ThemedText style={desktopStyles.contactNumberRevealed}>
                                      {ad.user.phone} <ThemedText style={desktopStyles.callText}>Tap to call</ThemedText>
                                    </ThemedText>
                                  </Pressable>
                                )}
                              </View>
                            )}

                            {/* Chat Button */}
                            <Pressable
                              style={desktopStyles.chatIconButton}
                              onPress={() => {
                                if (!isAuthenticated) {
                                  setLoginModalVisible(true);
                                  return;
                                }
                                if (ad?.slug) {
                                  router.push({
                                    pathname: '/(pages)/chat',
                                    params: {
                                      adSlug: ad.slug,
                                    }
                                  });
                                }
                              }}
                            >
                              <MaterialIcons name="chat-bubble-outline" size={18} color={Colors.light.primary} />
                              <ThemedText style={desktopStyles.chatIconText}>Chat</ThemedText>
                            </Pressable>
                          </View>
                        )}
                      </View>
                    </View>
                  )}

                  {/* Attachments */}
                  {getAttachments(ad).length > 0 && (
                    <View style={desktopStyles.section}>
                      <ThemedText style={desktopStyles.sectionTitle}>Attachments</ThemedText>
                      <AttributesList
                        attributes={getAttachments(ad)}
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
                          {getAdFullLocation(ad)}
                        </ThemedText>
                      </View>
                      {ad?.locationLatitude && ad?.locationLongitude && (
                        <View style={desktopStyles.mapContainer}>
                          <GoogleAdMap
                            latitude={ad.locationLatitude}
                            longitude={ad.locationLongitude}
                            height={200}
                          />
                        </View>
                      )}
                    </View>
                  </View>
                </View>
              </View>

              {/* Related Ads */}
              <View style={desktopStyles.relatedSection}>
                <ThemedText style={desktopStyles.sectionTitle}>Related Ads</ThemedText>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={desktopStyles.relatedContainer}
                >
                  {related.map((rad) => (
                    <AdCard
                      key={rad.id}
                      id={String(rad.id)}
                      slug={rad.slug}
                      title={rad.title}
                      description={rad.description}
                      location={getAdLocation(rad)}
                      price={!shouldHidePrice(rad.price) ? formatPrice(rad.price) : ''}
                      image={rad.images?.[0]}
                      category={rad.category?.name}
                      subcategory={rad.subcategory?.name}
                      categoryPlaceholder={rad.category?.adPlaceholder}
                      status={rad.status}
                      onPress={() => handleRelatedAdPress(rad.slug)}
                      onFavorite={handleRelatedFavorite}
                      isFavorite={rad.isFavorite || false}
                      containerStyle={{
                        width: 200,
                        marginRight: 16
                      }}
                    />
                  ))}
                </ScrollView>
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

        <Footer />
      </ScrollView>

      <ShareOptions
        visible={showShareMenu}
        onClose={() => setShowShareMenu(false)}
        onOptionPress={handleShareOption}
      />
    </View>
  );

  return isDesktop ? desktopView : mobileView;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
    minHeight: '100%',
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 20,
    paddingTop: 80,
  },
  reviewNoticeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFBEB',
    marginHorizontal: 16,
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  reviewNoticeText: {
    flex: 1,
    fontSize: 13,
    color: '#92400E',
    lineHeight: 18,
    fontWeight: '500',
  },
  // Banner
  bannerContainer: {
    width: '100%',
    height: width * 0.8, // 5:4 ratio
    marginTop: -20, // Reduced negative margin
    position: 'relative',
  },
  imageScroll: {
    width: '100%',
    height: '100%',
  },
  bannerImage: {
    width,
    height: width * 0.8, // 5:4 ratio
  },
  topGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 100,
    zIndex: 1,
  },
  bottomGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 40,
  },
  imageIndicator: {
    position: 'absolute',
    bottom: 16,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  indicatorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    marginHorizontal: 4,
  },
  indicatorDotActive: {
    backgroundColor: '#FFFFFF',
    width: 20,
  },
  // Title Section
  titleSection: {
    padding: 20,
    paddingBottom: 16,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 16,
    alignSelf: 'flex-start',
    marginBottom: 8,
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
    marginTop: 4,
  },
  titleContainer: {
    flex: 1,
    marginRight: 12,
  },
  favoriteButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.light.text,
    alignSelf: 'flex-start',
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
  },
  priceSection: {
    marginTop: 4,
  },
  posted: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    marginLeft: 8,
  },
  price: {
    fontSize: 22,
    fontWeight: 'bold',
    color: Colors.light.primary,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  discountPrice: {
    fontSize: 22,
    fontWeight: 'bold',
    color: Colors.light.primary,
  },
  originalPrice: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.light.textSecondary,
    textDecorationLine: 'line-through',
  },
  // Action Buttons
  actionSection: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 12,
  },
  shareButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: Colors.light.border,
    backgroundColor: Colors.light.card,
    justifyContent: 'center',
    alignItems: 'center',
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
  whatsappButtonExpired: {
    borderColor: Colors.light.textSecondary,
    backgroundColor: Colors.light.backgroundSecondary,
  },
  whatsappTextExpired: {
    color: Colors.light.textSecondary,
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
  // Sections
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
    fontSize: 18,
    fontWeight: '600',
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
  // Appointment Slots
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
  slotChipFull: {
    backgroundColor: '#F5F5F5',
    borderColor: '#E0E0E0',
  },
  slotTimeText: {
    fontSize: 13,
    color: Colors.light.text,
    fontWeight: '500',
  },
  slotTimeTextFull: {
    color: '#AAA',
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
    overflow: 'hidden',
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
    marginTop: 4,
  },
  publisherStatText: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    marginTop: 2,
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
  chatIconButtonExpired: {
    borderColor: Colors.light.textSecondary,
    backgroundColor: Colors.light.backgroundSecondary,
  },
  chatIconTextExpired: {
    color: Colors.light.textSecondary,
  },
  // Description
  descriptionContainer: {
    paddingHorizontal: 20,
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
    color: Colors.light.text,
  },
  // Related Ads
  relatedContainer: {
    paddingHorizontal: 20,
  },
});

// Desktop Styles
const desktopStyles = StyleSheet.create<any>({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  scrollView: {
    flex: 1,
    overflow: 'hidden',
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
    overflow: 'hidden',
  },
  desktopMainContent: {
    width: '100%',
    maxWidth: 1000,
    position: 'relative',
    overflow: 'hidden',
  },
  reviewNoticeBanner: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  reviewNoticeContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    maxWidth: 1000,
    width: '100%',
    marginHorizontal: 'auto',
    backgroundColor: '#FFFBEB',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FDE68A',
    marginTop: 24,
    marginBottom: 24,
  },
  reviewNoticeText: {
    flex: 1,
    fontSize: 15,
    color: '#92400E',
    lineHeight: 22,
    fontWeight: '500',
  },
  content: {
    maxWidth: 1000,
    width: '100%',
    marginHorizontal: 'auto',
    padding: 32,
    overflow: 'hidden',
  },
  mainContent: {
    flexDirection: 'row',
    gap: 32,
    marginBottom: 32,
    overflow: 'hidden',
  },
  // Left Column
  leftColumn: {
    width: '50%',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  // Image Section
  imageSection: {
    position: 'relative',
    width: '100%',
    overflow: 'hidden',
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
  imageIndicator: {
    position: 'absolute',
    bottom: 16,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  indicatorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    marginHorizontal: 4,
  },
  indicatorDotActive: {
    backgroundColor: Colors.light.primary,
    width: 24,
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    alignSelf: 'flex-start',
    marginBottom: 12,
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
    flexShrink: 0,
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
  whatsappButtonExpired: {
    borderColor: Colors.light.textSecondary,
    backgroundColor: Colors.light.backgroundSecondary,
  },
  whatsappTextExpired: {
    color: Colors.light.textSecondary,
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
  // Appointment Slots (Desktop)
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
  slotChipFull: {
    backgroundColor: '#F5F5F5',
    borderColor: '#E0E0E0',
  },
  slotTimeText: {
    fontSize: 14,
    color: Colors.light.text,
    fontWeight: '500',
  },
  slotTimeTextFull: {
    color: '#AAA',
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
    overflow: 'hidden',
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
    marginTop: 2,
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
  chatIconButtonExpired: {
    borderColor: Colors.light.textSecondary,
    backgroundColor: Colors.light.backgroundSecondary,
  },
  chatIconTextExpired: {
    color: Colors.light.textSecondary,
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
  // Related Ads
  relatedSection: {
    borderTopWidth: 1,
    borderTopColor: '#E9ECEF',
    paddingTop: 32,
  },
  relatedContainer: {
    paddingRight: 0,
  },
});
