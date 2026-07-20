import { MaterialIcons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View, ActivityIndicator, Dimensions, Platform, Share, Modal } from 'react-native';
import { NetworkImage } from '@/components/ui/network-image';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Footer } from '@/components/footer';
import { MobilePlatformBanners } from '@/components/mobile-platform-banners';
import { Colors, Shadows } from '@/constants/theme';
import { HEADER_HEIGHT } from '@/constants/layout';
import { adsService, platformAdsService } from '@/services';
import type { Ad, PlatformAd } from '@/types/api.types';
import { PlatformAdPosition } from '@/types/api.types';
import type { AdStats } from '@/services/ads.service';
import { useAlert } from '@/components/ui/custom-alert';
import { useRazorpay } from '@/hooks/use-razorpay';
import { AdNotFound404 } from '@/components/ui/ad-not-found-404';
import { settingsService } from '@/services/settings.service';
import { getAdStatusConfig } from '@/constants/status-config';
import { useBackNavigation, FALLBACK_ROUTES } from '@/utils/navigation-helpers';
import { RazorpayWebViewModal } from '@/components/ui/razorpay-webview-modal';
import { getDaysRemaining } from '@/utils/date-utils';
import { SideBanners } from '@/components/home/side-banners';
import { useResponsive } from '@/hooks/use-responsive';
import { appEvents } from '@/utils/event-emitter';

// Helper function to format numbers in Indian format
const formatIndianNumber = (num: number): string => {
  if (num === null || num === undefined || isNaN(num)) return '0';
  return new Intl.NumberFormat('en-IN').format(num);
};

// Helper function to format price with ₹ symbol
const formatPrice = (price: number | string | null | undefined): string => {
  if (price === undefined || price === null || price === '') return '';
  const numPrice = typeof price === 'string' ? parseFloat(price) : price;
  if (isNaN(numPrice)) return '';
  return `₹${formatIndianNumber(numPrice)}`;
};

// Helper to format ad location
function getAdLocation(ad: Ad | null): string {
  if (!ad) return '';
  if (ad.locationFormatted) return ad.locationFormatted;
  if (ad.locationCity) {
    if (ad.locationState) return `${ad.locationCity}, ${ad.locationState}`;
    return ad.locationCity;
  }
  return 'Location';
}

export default function AdStatsScreen() {
  const router = useRouter();
  const { goBack } = useBackNavigation(FALLBACK_ROUTES.AD_STATS);
  const { showAlert } = useAlert();
  const { getKey, renewSubscription, verifyPayment } = useRazorpay();
  const params = useLocalSearchParams();
  const [ad, setAd] = useState<Ad | null>(null);

  // Determine if ad is expired based on date
  const daysLeft = ad?.expiresAt ? getDaysRemaining(ad.expiresAt) : 1;
  const isExpiredByDate = ad?.expiresAt ? daysLeft < 0 : false;

  // Effective status for UI display
  const effectiveStatus = (ad?.status === 'APPROVED' && isExpiredByDate) ? 'EXPIRED' : (ad?.status || '');

  const [stats, setStats] = useState<AdStats>({ views: 0, favorites: 0, shares: 0, bookings: 0 });
  const [loading, setLoading] = useState(true);
  const [renewLoading, setRenewLoading] = useState(false);
  const [unpublishLoading, setUnpublishLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [showRenewModal, setShowRenewModal] = useState(false);
  const [subscriptionPrice, setSubscriptionPrice] = useState<number>(0);
  const [subscriptionDuration, setSubscriptionDuration] = useState<number>(0);
  const { isDesktop, screenWidth } = useResponsive();
  const [platformAds, setPlatformAds] = useState<PlatformAd[]>([]);
  const [isLoadingPlatformAds, setIsLoadingPlatformAds] = useState(true);

  // Payment modal state
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentModalOptions, setPaymentModalOptions] = useState<any>(null);

  // Fetch platform ads
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
    const slug = params.slug as string;
    if (!slug) return;
    fetchData(slug);
    loadSubscriptionSettings();
  }, [params.slug]);

  const loadSubscriptionSettings = async () => {
    try {
      const settings = await settingsService.getSubscriptionSettings();
      setSubscriptionPrice(settings.subscriptionPrice);
      setSubscriptionDuration(settings.subscriptionDuration);
    } catch (error) {
    }
  };

  const fetchData = async (slug: string) => {
    try {
      setLoading(true);
      const response = await adsService.getMyAd(slug);
      if (response.success && response.data) {
        setAd(response.data);
        setNotFound(false); // Reset notFound state when ad is found
        // Fetch stats
        const statsResponse = await adsService.getAdStats(response.data.id);
        if (statsResponse.success && statsResponse.data) {
          setStats(statsResponse.data);
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

  const handleShare = async () => {
    if (!ad) return;
    try {
      const shareUrl = Platform.OS === 'web'
        ? `${window.location.origin}/detail/${ad.slug || ad.id}`
        : `https://pinnpost.com/detail/${ad.slug || ad.id}`;

      const shareMessage = `${ad.title}\n\n${ad.description}\n\nPrice: ${formatPrice(ad.price)}\n\nView more: ${shareUrl}`;

      if (Platform.OS === 'web' && navigator.share) {
        await navigator.share({
          text: shareMessage,
          url: shareUrl,
          title: ad.title
        });
      } else if (Platform.OS === 'web') {
        // Fallback: copy to clipboard
        await navigator.clipboard.writeText(shareMessage);
        showAlert({ title: 'Copied!', message: 'Link copied to clipboard', type: 'success' });
      } else {
        await Share.share({
          message: shareMessage,
          url: shareUrl,
          title: ad.title
        });
      }

      await adsService.recordShare(ad.id);
      setStats(prev => ({ ...prev, shares: prev.shares + 1 }));
    } catch (e: any) {
      if (e.message !== 'Share canceled') {
      }
    }
  };

  const handleRenewSubscription = () => {
    setShowRenewModal(true);
  };

  const processRenewalPayment = async () => {
    if (!ad) return;
    setShowRenewModal(false);
    setRenewLoading(true);

    try {
      // Create payment order
      const orderResponse = await renewSubscription(ad.id);

      if (!orderResponse || !orderResponse.paymentIntentId) {
        throw new Error('Failed to create payment order');
      }

      // Prepare payment options
      const paymentOptions = {
        key: getKey(),
        amount: orderResponse.amount * 100,
        currency: orderResponse.currency,
        name: 'Subscription Renewal',
        description: `Renew "${ad.title}"`,
        order_id: orderResponse.paymentIntentId,
        prefill: {
          name: ad.user?.firstName + ' ' + ad.user?.lastName,
          email: ad.user?.email,
          contact: ad.user?.phone,
        }
      };

      if (Platform.OS === 'web') {
        // Web: Use direct Razorpay checkout
        const paymentResult = await openRazorpayWeb(paymentOptions);

        // Verify payment
        await verifyAndCompleteRenewal(
          paymentResult.razorpay_order_id,
          paymentResult.razorpay_payment_id,
          paymentResult.razorpay_signature
        );
      } else {
        // Mobile: Save pending order BEFORE showing WebView
        // (so if the app is killed while in Google Pay, we recover on restart)
        const { savePendingOrder } = await import('@/hooks/use-razorpay');
        await savePendingOrder(orderResponse.paymentIntentId, ad.id);

        // Show WebView modal for payment
        setPaymentModalOptions(paymentOptions);
        setShowPaymentModal(true);
        setRenewLoading(false);
      }
    } catch (e: any) {
      setRenewLoading(false);
      showAlert({ title: 'Error', message: e?.message || 'Failed to renew subscription', type: 'error' });
    }
  };

  // Helper function for web Razorpay checkout
  const openRazorpayWeb = async (options: any): Promise<any> => {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => {
        const rzp = new (window as any).Razorpay({
          ...options,
          handler: function (response: any) {
            resolve(response);
          },
          modal: {
            ondismiss: function () {
              reject(new Error('Payment cancelled'));
            },
          },
        });
        rzp.open();
      };
      script.onerror = () => reject(new Error('Failed to load Razorpay'));
      document.body.appendChild(script);
    });
  };

  // Helper function to verify payment and complete renewal
  const verifyAndCompleteRenewal = async (
    razorpay_order_id: string,
    razorpay_payment_id: string,
    razorpay_signature: string
  ) => {
    if (!ad) return;
    try {
      // Verify payment
      await verifyPayment(
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
        ad.id
      );

      showAlert({ title: 'Success', message: 'Subscription renewed successfully!', type: 'success' });
      fetchData(ad.slug || ad.id);
    } catch (e: any) {
      showAlert({ title: 'Error', message: e?.message || 'Failed to verify payment', type: 'error' });
    } finally {
      setRenewLoading(false);
      setShowPaymentModal(false);
    }
  };

  // Payment modal success callback
  const handlePaymentSuccess = async (data: any) => {
    await verifyAndCompleteRenewal(
      data.razorpay_order_id,
      data.razorpay_payment_id,
      data.razorpay_signature
    );
  };

  // Payment modal error callback
  const handlePaymentError = (error: string) => {
    setRenewLoading(false);
    setShowPaymentModal(false);
    showAlert({ title: 'Error', message: error, type: 'error' });
  };

  // Payment modal close callback
  const handlePaymentClose = () => {
    setRenewLoading(false);
    setShowPaymentModal(false);
  };

  const handleUnpublish = async () => {
    if (!ad) return;

    // Show confirmation dialog
    showAlert({
      title: 'Unpublish Ad?',
      message: 'Your ad will be hidden from public view. You can republish it anytime.',
      type: 'warning',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unpublish',
          style: 'destructive',
          onPress: async () => {
            setUnpublishLoading(true);
            try {
              const response = await adsService.unpublishAd(ad.id);
              if (response.success && response.data) {
                setAd(response.data);
                showAlert({ title: 'Success', message: 'Ad unpublished successfully', type: 'success' });
              } else {
                showAlert({ title: 'Error', message: 'Failed to unpublish ad', type: 'error' });
              }
            } catch (e: any) {
              showAlert({ title: 'Error', message: e?.message || 'Failed to unpublish ad', type: 'error' });
            } finally {
              setUnpublishLoading(false);
            }
          }
        }
      ]
    });
  };

  const handleRepublish = async () => {
    if (!ad) return;

    // Show confirmation dialog
    showAlert({
      title: 'Republish Ad?',
      message: 'Your ad will be visible to the public again.',
      type: 'warning',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Republish',
          style: 'default',
          onPress: async () => {
            setUnpublishLoading(true);
            try {
              const response = await adsService.republishAd(ad.id);
              if (response.success && response.data) {
                setAd(response.data);
                showAlert({ title: 'Success', message: 'Ad republished successfully', type: 'success' });
              } else {
                showAlert({ title: 'Error', message: 'Failed to republish ad', type: 'error' });
              }
            } catch (e: any) {
              showAlert({ title: 'Error', message: e?.message || 'Failed to republish ad', type: 'error' });
            } finally {
              setUnpublishLoading(false);
            }
          }
        }
      ]
    });
  };

  const handleDeleteAd = async () => {
    if (!ad) return;

    showAlert({
      title: 'Delete Ad?',
      message: 'This action is permanent and cannot be undone.',
      type: 'warning',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeleteLoading(true);
            try {
              const response = await adsService.deleteAd(ad.id);
              if (response.success) {
                appEvents.emit('ad:deleted', { adId: ad.id });
                router.replace('/(tabs)/my-ads?deleted=1');
                return;
              }

              showAlert({ title: 'Error', message: 'Failed to delete ad', type: 'error' });
            } catch (e: any) {
              showAlert({ title: 'Error', message: e?.message || 'Failed to delete ad', type: 'error' });
            } finally {
              setDeleteLoading(false);
            }
          }
        }
      ]
    });
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'APPROVED': return 'Active';
      case 'REVIEW': return 'In Review';
      case 'REJECTED': return 'Rejected';
      case 'EXPIRED': return 'Expired';
      case 'UNPUBLISHED': return 'Unpublished';
      default: return status;
    }
  };

  // Check if ad can be shared
  const canShare = effectiveStatus === 'APPROVED';

  // Check if ad can be edited - hide edit button if ad is published (APPROVED)
  const canEdit = effectiveStatus !== 'EXPIRED' && effectiveStatus !== 'APPROVED';

  // Check if ad is approved (for unpublish button)
  const isApproved = effectiveStatus === 'APPROVED';

  // Check if ad is unpublished (for republish button)
  const isUnpublished = effectiveStatus === 'UNPUBLISHED';

  // Check if ad has pending changes
  const hasPendingChanges = ad?.hasRevision || ad?.hasPendingChanges;

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
      <ThemedView style={styles.container}>
        <AdNotFound404 />
        <Footer />
      </ThemedView>
    );
  }

  if (!ad) {
    return null;
  }

  return (
    <>
    <ThemedView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
      >
        <View style={isDesktop ? styles.desktopHomeWrapper : null}>
          {isDesktop && (
            <SideBanners 
              ads={platformAds.filter(ad => ad.position === PlatformAdPosition.LEFT)} 
              position={PlatformAdPosition.LEFT} 
            />
          )}

          <View style={isDesktop ? styles.desktopMainContent : null}>
            <View style={[styles.content, isDesktop && styles.desktopContent]}>
              {/* Header */}
              <View style={[styles.header, isDesktop && styles.desktopHeader]}>
                <TouchableOpacity onPress={goBack} style={styles.backButton}>
                  <MaterialIcons name="arrow-back" size={24} color={Colors.light.text} />
                </TouchableOpacity>
                <View style={styles.headerContent}>
                  <ThemedText style={[styles.headerTitle, isDesktop && styles.desktopHeaderTitle]}>Ad Dashboard</ThemedText>
                  <ThemedText style={styles.headerSubtitle}>Manage and track your ad</ThemedText>
                </View>

              </View>

              {!isDesktop && <MobilePlatformBanners ads={platformAds} position="top" style={{ marginVertical: 8, paddingHorizontal: 16 }} />}

              {/* Desktop Two Column Layout */}
              <View style={[styles.mainGrid, isDesktop && styles.desktopMainGrid]}>
                {/* Left Column - Ad Preview & Stats */}
                <View style={[styles.leftColumn, isDesktop && styles.desktopLeftColumn]}>
                  {/* Ad Preview */}
                  <ThemedView style={[styles.adPreviewSection, isDesktop && styles.desktopCard]}>
                    <View style={styles.adPreviewHeader}>
                      <View style={{ flex: 1 }}>
                        <ThemedText style={[styles.adPreviewTitle, isDesktop && styles.desktopAdTitle]}>{ad.title}</ThemedText>
                        <ThemedText style={styles.adCategory}>{ad.category?.name}{ad.subcategory ? ` • ${ad.subcategory.name}` : ''}</ThemedText>
                      </View>
                      <View style={[styles.statusBadge, { backgroundColor: getAdStatusConfig(effectiveStatus).backgroundColor }]}>
                        <View style={[styles.statusDot, { backgroundColor: getAdStatusConfig(effectiveStatus).textColor }]} />
                        <ThemedText style={[styles.statusText, { color: getAdStatusConfig(effectiveStatus).textColor }]}>{getStatusLabel(effectiveStatus)}</ThemedText>
                      </View>
                    </View>

                    {ad.status === 'REJECTED' && (
                      <View style={[styles.rejectionReasonContainer, isDesktop && styles.desktopRejectionReasonContainer]}>
                        <View style={styles.rejectionReasonHeader}>
                      <View style={styles.rejectionReasonIconBg}>
                        <MaterialIcons name="error-outline" size={isDesktop ? 20 : 18} color={Colors.light.danger} />
                      </View>
                      <View style={styles.rejectionReasonTitleWrapper}>
                        <ThemedText style={styles.rejectionReasonTitle}>Ad Rejected</ThemedText>
                        <ThemedText style={styles.rejectionReasonSubtitle}>Please review and edit your ad</ThemedText>
                      </View>
                    </View>
                    <View style={[styles.rejectionReasonContent, isDesktop && styles.desktopRejectionReasonContent]}>
                      <ThemedText style={[styles.rejectionReasonText, isDesktop && styles.desktopRejectionReasonText]}>
                        {ad.rejectionReason || 'No specific reason was provided. Please ensure your ad follows our guidelines.'}
                      </ThemedText>
                    </View>
                  </View>
                )}

                {hasPendingChanges && effectiveStatus === 'APPROVED' && (
                  <View style={[styles.pendingChangesContainer, isDesktop && styles.desktopPendingChangesContainer]}>
                    <View style={styles.pendingChangesHeader}>
                      <View style={styles.pendingChangesIconBg}>
                        <MaterialIcons name="hourglass-top" size={isDesktop ? 20 : 18} color={Colors.light.warning} />
                      </View>
                      <View style={styles.pendingChangesTitleWrapper}>
                        <ThemedText style={styles.pendingChangesTitle}>Changes Pending Review</ThemedText>
                        <ThemedText style={styles.pendingChangesSubtitle}>Your edits are being reviewed by admin</ThemedText>
                      </View>
                    </View>
                    <View style={[styles.pendingChangesContent, isDesktop && styles.desktopPendingChangesContent]}>
                      <ThemedText style={[styles.pendingChangesText, isDesktop && styles.desktopPendingChangesText]}>
                        You have submitted changes to this ad. The changes will be auto-applied within 24 hours or once approved by an admin.
                      </ThemedText>
                    </View>
                  </View>
                )}

                {ad.images && ad.images.length > 0 && (
                  <View style={styles.adImageContainer}>
                    <View style={[styles.adImageGallery, isDesktop && styles.desktopAdImageGallery]}>
                      {ad.images.slice(0, isDesktop ? 4 : 3).map((image, index) => (
                        <View key={index} style={[styles.adImageItem, isDesktop && styles.desktopAdImageItem]}>
                          <NetworkImage source={{ uri: image }} style={styles.adImage} contentFit="cover" resizeMode="cover" />
                          {((isDesktop && index === 3 && ad.images.length > 4) || (!isDesktop && index === 2 && ad.images.length > 3)) && (
                            <View style={styles.imageCountOverlay}>
                              <ThemedText style={styles.imageCountText}>+{ad.images.length - (isDesktop ? 4 : 3)}</ThemedText>
                            </View>
                          )}
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                {/* Quick Info Row */}
                <View style={styles.quickInfoRow}>
                  {ad.price && (
                    <View style={styles.quickInfoItem}>
                      <ThemedText style={styles.quickInfoLabel}>Price</ThemedText>
                      {ad.discountedPrice ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <ThemedText style={[styles.quickInfoValue, { color: Colors.light.primary }]}>{formatPrice(ad.discountedPrice)}</ThemedText>
                          <ThemedText style={[styles.quickInfoValue, { textDecorationLine: 'line-through', fontSize: 12, color: Colors.light.textSecondary }]}>{formatPrice(ad.price)}</ThemedText>
                        </View>
                      ) : (
                        <ThemedText style={styles.quickInfoValue}>{formatPrice(ad.price)}</ThemedText>
                      )}
                    </View>
                  )}
                  <View style={styles.quickInfoItem}>
                    <ThemedText style={styles.quickInfoLabel}>Created</ThemedText>
                    <ThemedText style={styles.quickInfoValue}>{new Date(ad.createdAt).toLocaleDateString()}</ThemedText>
                  </View>
                </View>
              </ThemedView>

              {/* Performance Stats */}
              <ThemedView style={[styles.statsSection, isDesktop && styles.desktopCard]}>
                <ThemedText style={[styles.sectionTitle, isDesktop && styles.desktopSectionTitle]}>Performance Metrics</ThemedText>
                <View style={[styles.statsGrid, isDesktop && styles.desktopStatsGrid]}>
                  {[
                    { icon: 'visibility', value: stats.views, label: 'Views' },
                    { icon: 'favorite', value: stats.favorites, label: 'Favorites' },
                    { icon: 'share', value: stats.shares, label: 'Shares' },
                    { icon: 'event', value: stats.bookings, label: 'Bookings' },
                  ].map((stat, i) => (
                    <View key={i} style={[styles.statCard, isDesktop && styles.desktopStatCard]}>
                      <View style={styles.statIconContainer}>
                        <MaterialIcons name={stat.icon as any} size={isDesktop ? 20 : 16} color={Colors.light.primary} />
                      </View>
                      <ThemedText style={[styles.statValue, isDesktop && styles.desktopStatValue]}>{formatIndianNumber(stat.value)}</ThemedText>
                      <ThemedText style={[styles.statLabel, isDesktop && styles.desktopStatLabel]}>{stat.label}</ThemedText>
                    </View>
                  ))}
                </View>
              </ThemedView>
            </View>

            {/* Right Column */}
            <View style={[styles.rightColumn, isDesktop && styles.desktopRightColumn]}>
              {/* Ad Details */}
              <ThemedView style={[styles.section, isDesktop && styles.desktopCard]}>
                <ThemedText style={[styles.sectionTitle, isDesktop && styles.desktopSectionTitle]}>Ad Details</ThemedText>
                {[
                  { label: 'Category', value: ad.category?.name },
                  ad.subcategory && { label: 'Subcategory', value: ad.subcategory.name },
                  ad.price && { label: 'Price', value: formatPrice(ad.price) },
                  ad.discountedPrice && { label: 'Discounted Price', value: formatPrice(ad.discountedPrice) },
                  { label: 'Booking Enabled', value: ad.enableBooking ? 'Yes' : 'No' },
                  { label: 'Created', value: new Date(ad.createdAt).toLocaleDateString() },
                  { label: 'Location', value: getAdLocation(ad) },
                  ad.expiresAt && {
                    label: effectiveStatus === 'EXPIRED' ? 'Expired' : 'Expires',
                    value: new Date(ad.expiresAt).toLocaleDateString()
                  },
                ].filter(Boolean).map((item: any, i) => (
                  <View key={i} style={[styles.detailRow, isDesktop && styles.desktopDetailRow]}>
                    <ThemedText style={styles.detailLabel}>{item.label}</ThemedText>
                    <ThemedText style={styles.detailValue}>{item.value}</ThemedText>
                  </View>
                ))}
              </ThemedView>

              {/* Attributes */}
              {ad.attributes && ad.attributes.length > 0 && (
                <ThemedView style={[styles.section, isDesktop && styles.desktopCard]}>
                  <ThemedText style={[styles.sectionTitle, isDesktop && styles.desktopSectionTitle]}>Attributes</ThemedText>
                  {ad.attributes.map((attr, i) => (
                    <View key={i} style={[styles.detailRow, isDesktop && styles.desktopDetailRow]}>
                      <ThemedText style={styles.detailLabel}>{attr.attribute?.name}</ThemedText>
                      <ThemedText style={styles.detailValue}>{attr.value}</ThemedText>
                    </View>
                  ))}
                </ThemedView>
              )}

              {/* Action Buttons */}
              <View style={[styles.actionButtonsContainer, isDesktop && styles.desktopActionsContainer]}>
                {/* Renew/Extend button for expired or expiring approved ads */}
                {(effectiveStatus === 'EXPIRED' || (effectiveStatus === 'APPROVED' && ad.expiresAt)) && (
                  <TouchableOpacity
                    style={[styles.actionButton, styles.renewButton, isDesktop && styles.desktopActionButton]}
                    onPress={handleRenewSubscription}
                    disabled={renewLoading}
                  >
                    {renewLoading ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <MaterialIcons name="autorenew" size={18} color="#fff" />
                        <ThemedText style={[styles.actionButtonText, { color: '#fff' }]}>
                          {effectiveStatus === 'EXPIRED' ? 'Renew Ad' : 'Extend'}
                        </ThemedText>
                      </>
                    )}
                  </TouchableOpacity>
                )}

                {/* Edit button - always show except for expired ads */}
                {canEdit && (
                  <TouchableOpacity
                    style={[styles.actionButton, styles.editButton, isDesktop && styles.desktopActionButton]}
                    onPress={() => router.push(`/(pages)/edit-ad/${ad.slug || ad.id}`)}
                  >
                    <MaterialIcons name="edit" size={18} color={Colors.light.primary} />
                    <ThemedText style={[styles.actionButtonText, { color: Colors.light.primary }]}>
                      {ad.status === 'REJECTED' ? 'Edit & Resubmit' : 'Edit'}
                    </ThemedText>
                  </TouchableOpacity>
                )}

                {/* Unpublish button - only for approved ads */}
                {isApproved && (
                  <TouchableOpacity
                    style={[styles.actionButton, styles.unpublishButton, isDesktop && styles.desktopActionButton]}
                    onPress={handleUnpublish}
                    disabled={unpublishLoading}
                  >
                    {unpublishLoading ? (
                      <ActivityIndicator size="small" color={Colors.light.warning} />
                    ) : (
                      <>
                        <MaterialIcons name="pause-circle" size={18} color={Colors.light.warning} />
                        <ThemedText style={[styles.actionButtonText, { color: Colors.light.warning }]}>Unpublish</ThemedText>
                      </>
                    )}
                  </TouchableOpacity>
                )}

                {/* Republish button - only for unpublished ads */}
                {isUnpublished && (
                  <TouchableOpacity
                    style={[styles.actionButton, styles.republishButton, isDesktop && styles.desktopActionButton]}
                    onPress={handleRepublish}
                    disabled={unpublishLoading}
                  >
                    {unpublishLoading ? (
                      <ActivityIndicator size="small" color={Colors.light.success} />
                    ) : (
                      <>
                        <MaterialIcons name="play-circle" size={18} color={Colors.light.success} />
                        <ThemedText style={[styles.actionButtonText, { color: Colors.light.success }]}>Republish</ThemedText>
                      </>
                    )}
                  </TouchableOpacity>
                )}

                {/* View button - always show */}
                <TouchableOpacity
                  style={[styles.actionButton, styles.viewButton, isDesktop && styles.desktopActionButton]}
                  onPress={() => router.push(`/(pages)/detail/${ad.slug || ad.id}`)}
                >
                  <MaterialIcons name="visibility" size={18} color={Colors.light.textSecondary} />
                  <ThemedText style={styles.actionButtonText}>View Ad</ThemedText>
                </TouchableOpacity>

                {/* Share button - only for approved ads */}
                {canShare && (
                  <TouchableOpacity
                    style={[styles.actionButton, styles.shareButton, isDesktop && styles.desktopActionButton]}
                    onPress={handleShare}
                  >
                    <MaterialIcons name="share" size={18} color={Colors.light.textSecondary} />
                    <ThemedText style={styles.actionButtonText}>Share</ThemedText>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={[styles.actionButton, styles.deleteButton, isDesktop && styles.desktopActionButton]}
                  onPress={handleDeleteAd}
                  disabled={deleteLoading}
                >
                  {deleteLoading ? (
                    <ActivityIndicator size="small" color={Colors.light.danger} />
                  ) : (
                    <>
                      <MaterialIcons name="delete-outline" size={18} color={Colors.light.danger} />
                      <ThemedText style={[styles.actionButtonText, { color: Colors.light.danger }]}>Delete</ThemedText>
                    </>
                  )}
                </TouchableOpacity>

                {/* Bookings button - only for approved ads with booking enabled */}
                {isApproved && ad.enableBooking && (
                  <TouchableOpacity
                    style={[styles.actionButton, styles.bookingsButton, isDesktop && styles.desktopActionButton]}
                    onPress={() => router.push(`/(pages)/ad-bookings?adId=${ad.id}`)}
                  >
                    <MaterialIcons name="event" size={18} color={Colors.light.textSecondary} />
                    <ThemedText style={styles.actionButtonText}>Bookings</ThemedText>
                  </TouchableOpacity>
                )}
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
      {!isDesktop && <MobilePlatformBanners ads={platformAds} position="bottom" style={{ marginTop: 4, marginBottom: 24, paddingHorizontal: 16 }} />}
      <Footer />
    </ScrollView>
  </ThemedView>

      {/* Renewal Confirmation Modal */}
      <Modal
        visible={showRenewModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowRenewModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, isDesktop && styles.desktopModalContent]}>
            <View style={styles.modalHeader}>
              <MaterialIcons name="autorenew" size={28} color={Colors.light.primary} />
              <ThemedText style={styles.modalTitle}>Extend Subscription</ThemedText>
            </View>

            <View style={styles.modalBody}>
              <View style={styles.renewalInfoCard}>
                <ThemedText style={styles.renewalInfoLabel}>Ad Title</ThemedText>
                <ThemedText style={styles.renewalInfoValue}>{ad?.title}</ThemedText>
              </View>

              <View style={styles.renewalInfoRow}>
                <View style={[styles.renewalInfoCard, styles.renewalInfoCardHalf]}>
                  <ThemedText style={styles.renewalInfoLabel}>Duration</ThemedText>
                  <ThemedText style={styles.renewalInfoValue}>{subscriptionDuration} days</ThemedText>
                </View>
                <View style={[styles.renewalInfoCard, styles.renewalInfoCardHalf]}>
                  <ThemedText style={styles.renewalInfoLabel}>Price</ThemedText>
                  <ThemedText style={styles.renewalInfoValue}>{formatPrice(subscriptionPrice)}</ThemedText>
                </View>
              </View>

              <View style={styles.renewalInfoCard}>
                <ThemedText style={styles.renewalInfoLabel}>Current Expiry</ThemedText>
                <ThemedText style={styles.renewalInfoValue}>
                  {ad?.expiresAt ? new Date(ad.expiresAt).toLocaleDateString() : 'Expired'}
                </ThemedText>
              </View>

              <View style={styles.renewalInfoCard}>
                <ThemedText style={styles.renewalInfoLabel}>New Expiry Date</ThemedText>
                <ThemedText style={[styles.renewalInfoValue, styles.newExpiryText]}>
                  {(() => {
                    const baseDate = effectiveStatus === 'EXPIRED'
                      ? new Date()
                      : ad?.expiresAt
                        ? new Date(ad.expiresAt)
                        : new Date();
                    const newExpiry = new Date(baseDate);
                    newExpiry.setDate(newExpiry.getDate() + subscriptionDuration);
                    return newExpiry.toLocaleDateString();
                  })()}
                </ThemedText>
              </View>

              <View style={styles.renewalInfoNote}>
                <MaterialIcons name="info" size={16} color={Colors.light.textSecondary} />
                <ThemedText style={styles.renewalNoteText}>
                  {effectiveStatus === 'EXPIRED'
                    ? `Your subscription will be renewed for ${subscriptionDuration} days starting today.`
                    : `Your subscription will be extended by ${subscriptionDuration} days from the current expiry date.`}
                </ThemedText>
              </View>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => setShowRenewModal(false)}
              >
                <ThemedText style={styles.modalButtonCancelText}>Cancel</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonConfirm]}
                onPress={processRenewalPayment}
              >
                <ThemedText style={styles.modalButtonConfirmText}>Pay {formatPrice(subscriptionPrice)}</ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Razorpay WebView Modal for Mobile */}
      {Platform.OS !== 'web' && paymentModalOptions && (
        <RazorpayWebViewModal
          visible={showPaymentModal}
          options={paymentModalOptions}
          onSuccess={handlePaymentSuccess}
          onError={handlePaymentError}
          onClose={handlePaymentClose}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingTop: HEADER_HEIGHT,
    paddingBottom: 20,
    paddingHorizontal: 12,
  },
  desktopContent: {
    maxWidth: 1280,
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: 48,
    paddingTop: 32,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: Colors.light.card,
    // marginBottom: 16,
    marginTop: 10,
    borderRadius: 12,
    ...Shadows.soft,
  },
  desktopHeader: {
    marginHorizontal: 0,
    marginBottom: 24,
    padding: 20,
    borderRadius: 16,
  },
  backButton: {
    marginRight: 16,
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#EBEBEB',
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.light.text,
  },
  desktopHeaderTitle: {
    fontSize: 22,
  },
  headerSubtitle: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    marginTop: 1,
  },

  mainGrid: {
    flexDirection: 'column',
    // Ensure each child takes its natural height on mobile
  },
  desktopMainGrid: {
    flexDirection: 'row',
    gap: 24,
    alignItems: 'flex-start',
  },
  leftColumn: {
    width: '100%',
  },
  desktopLeftColumn: {
    flex: 2,
    width: 'auto',
  },
  rightColumn: {
    width: '100%',
  },
  desktopRightColumn: {
    flex: 1,
    width: 'auto',
  },
  adPreviewSection: {
    backgroundColor: Colors.light.card,
    padding: 12,
    marginBottom: 10,
    borderRadius: 10,
    overflow: 'hidden',
    ...Shadows.soft,
  },
  desktopCard: {
    marginHorizontal: 0,
    borderRadius: 16,
    padding: 24,
    marginBottom: 24,
  },
  adPreviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  adPreviewTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.light.text,
    marginBottom: 2,
  },
  desktopAdTitle: {
    fontSize: 20,
  },
  adCategory: {
    fontSize: 12,
    color: Colors.light.textSecondary,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 16,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 4,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  rejectionReasonContainer: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FCA5A5',
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 10,
    overflow: 'hidden',
  },
  desktopRejectionReasonContainer: {
    marginBottom: 12,
    borderRadius: 10,
  },
  rejectionReasonHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    backgroundColor: '#FEE2E2',
    borderBottomWidth: 1,
    borderBottomColor: '#FCA5A5',
  },
  rejectionReasonIconBg: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  rejectionReasonTitleWrapper: {
    flex: 1,
  },
  rejectionReasonTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.light.danger,
    lineHeight: 16,
  },
  rejectionReasonSubtitle: {
    fontSize: 10,
    color: Colors.light.textSecondary,
    lineHeight: 14,
  },
  rejectionReasonContent: {
    padding: 8,
  },
  desktopRejectionReasonContent: {
    padding: 10,
  },
  rejectionReasonLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.light.textSecondary,
  },
  // Pending Changes styles
  pendingChangesContainer: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FCD34D',
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 10,
    overflow: 'hidden',
  },
  desktopPendingChangesContainer: {
    marginBottom: 12,
    borderRadius: 10,
  },
  pendingChangesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    backgroundColor: '#FEF3C7',
    borderBottomWidth: 1,
    borderBottomColor: '#FCD34D',
  },
  pendingChangesIconBg: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  pendingChangesTitleWrapper: {
    flex: 1,
  },
  pendingChangesTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.light.warning,
    lineHeight: 16,
  },
  pendingChangesSubtitle: {
    fontSize: 10,
    color: Colors.light.textSecondary,
    lineHeight: 14,
  },
  pendingChangesContent: {
    padding: 8,
  },
  desktopPendingChangesContent: {
    padding: 10,
  },
  pendingChangesText: {
    fontSize: 12,
    color: Colors.light.text,
    lineHeight: 16,
    fontWeight: '500',
  },
  desktopPendingChangesText: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  rejectionReasonText: {
    fontSize: 12,
    color: Colors.light.text,
    lineHeight: 16,
    fontWeight: '500',
  },
  desktopRejectionReasonText: {
    fontSize: 13,
    lineHeight: 18,
  },
  adImageContainer: {
    marginBottom: 10,
  },
  adImageGallery: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  desktopAdImageGallery: {
    gap: 10,
  },
  adImageItem: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 10,
    overflow: 'hidden',
    minWidth: '30%',
    position: 'relative',
  },
  desktopAdImageItem: {
    minWidth: '22%',
    borderRadius: 12,
  },
  adImage: {
    width: '100%',
    height: '100%',
  },
  imageCountOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageCountText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  quickInfoRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
    paddingTop: 12,
    gap: 12,
  },
  quickInfoItem: {
    flex: 1,
  },
  quickInfoLabel: {
    fontSize: 10,
    color: Colors.light.textSecondary,
    marginBottom: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  quickInfoValue: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.light.text,
  },
  statsSection: {
    backgroundColor: Colors.light.card,
    padding: 12,
    marginBottom: 10,
    borderRadius: 10,
    overflow: 'hidden',
    ...Shadows.soft,
  },
  section: {
    backgroundColor: Colors.light.card,
    padding: 12,
    marginBottom: 10,
    borderRadius: 10,
    overflow: 'hidden',
    ...Shadows.soft,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 12,
    color: Colors.light.text,
    borderLeftWidth: 3,
    borderLeftColor: Colors.light.primary,
    paddingLeft: 10,
  },
  desktopSectionTitle: {
    fontSize: 16,
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    gap: 8,
    justifyContent: 'space-between',
  },
  desktopStatsGrid: {
    gap: 16,
    flexWrap: 'wrap',
  },
  statCard: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderRadius: 12,
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
    borderWidth: 1,
    borderColor: '#E8E8E8',
    ...Shadows.soft,
  },
  desktopStatCard: {
    minWidth: 100,
    padding: 20,
    borderRadius: 16,
    flexBasis: '22%',
  },
  statIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.light.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.light.text,
    marginBottom: 2,
  },
  desktopStatValue: {
    fontSize: 24,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.light.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  desktopStatLabel: {
    fontSize: 11,
  },
  editButton: {
    borderColor: Colors.light.primary + '30',
    backgroundColor: Colors.light.primary + '08',
  },
  renewButton: {
    backgroundColor: Colors.light.primary,
    borderColor: Colors.light.primary,
  },
  unpublishButton: {
    borderColor: Colors.light.warning + '30',
    backgroundColor: Colors.light.warning + '08',
  },
  republishButton: {
    borderColor: Colors.light.success + '30',
    backgroundColor: Colors.light.success + '08',
  },
  deleteButton: {
    borderColor: Colors.light.danger + '30',
    backgroundColor: Colors.light.danger + '08',
  },
  shareButton: {},
  bookingsButton: {},
  viewButton: {},
  actionButtonsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 0,
    paddingVertical: 4,
    gap: 6,
    marginBottom: 10,
  },
  desktopActionsContainer: {
    paddingHorizontal: 0,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 0,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.light.border,
    backgroundColor: Colors.light.card,
    gap: 4,
    minHeight: 38,
    flex: 1,
    flexBasis: '47%',
    ...Shadows.soft,
  },
  desktopActionButton: {
    flexBasis: '47%',
    minHeight: 42,
    paddingVertical: 10,
  },
  actionButtonText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.light.text,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  desktopDetailRow: {
    paddingVertical: 10,
  },
  detailLabel: {
    fontSize: 12,
    color: Colors.light.textSecondary,
  },
  detailValue: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.light.text,
    flex: 1,
    textAlign: 'right',
    marginLeft: 24,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    width: '100%',
    maxWidth: 400,
    ...Shadows.medium,
  },
  desktopModalContent: {
    maxWidth: 450,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.light.text,
  },
  modalBody: {
    padding: 20,
    gap: 16,
  },
  renewalInfoCard: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  renewalInfoCardHalf: {
    flex: 1,
  },
  renewalInfoRow: {
    flexDirection: 'row',
    gap: 12,
  },
  renewalInfoLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.light.textSecondary,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  renewalInfoValue: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
  },
  newExpiryText: {
    color: Colors.light.primary,
  },
  renewalInfoNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#E3F2FD',
    borderRadius: 8,
    padding: 12,
  },
  renewalNoteText: {
    flex: 1,
    fontSize: 13,
    color: Colors.light.text,
    lineHeight: 18,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalButtonCancel: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  modalButtonConfirm: {
    backgroundColor: Colors.light.primary,
  },
  modalButtonCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
  },
  modalButtonConfirmText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
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
});
