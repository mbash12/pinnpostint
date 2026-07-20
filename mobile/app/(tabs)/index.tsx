import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useState, useEffect } from 'react';
import { Dimensions, ScrollView, StyleSheet, Pressable, View, ActivityIndicator, Platform, RefreshControl } from 'react-native';
import { NetworkImage } from '@/components/ui/network-image';

import { AdCard } from '@/components/ad-card';
import { Footer } from '@/components/footer';
import { MobilePlatformBanners } from '@/components/mobile-platform-banners';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { SubcategoryModal } from '@/components/ui/subcategory-modal';
import { HeroSection } from '@/components/home/hero-section';
import { CategoriesSection } from '@/components/home/categories-section';
import { Colors, WebShadows, TabBar } from '@/constants/theme';
import { formatPrice, shouldHidePrice } from '@/utils/price-formatter';
import { useCategory } from '@/hooks/use-category';
import { useResponsive } from '@/hooks/use-responsive';
import { useFavoriteToggle } from '@/hooks/use-favorite-toggle';
import { useSelectedLocation } from '@/contexts/location-context';
import { LocationBanner } from '@/components/location-banner';
import { adsService, categoriesService, platformAdsService } from '@/services';
import { useAuth } from '@/contexts/auth-context';
import { SideBanners } from '@/components/home/side-banners';
import { PlatformAd, PlatformAdPosition } from '@/types/api.types';
import type { Ad, Category } from '@/types/api.types';

const { width } = Dimensions.get('window');
const ITEM_WIDTH = width / 5 - 16; // 5 items per screen with padding

// No dummy fallbacks; sections render only when API returns data

const features = [
  { icon: 'verified-user', title: 'Trusted Sellers', description: 'Connect with verified sellers in your community' },
  { icon: 'local-mall', title: 'Local Marketplace', description: 'Buy and sell within your city and neighborhood' },
  { icon: 'chat-bubble-outline', title: 'Easy Communication', description: 'Direct messaging with sellers for quick deals' },
  { icon: 'receipt-long', title: 'Simple Process', description: 'Effortless posting and browsing of ads' },
];

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [showSubcategoryModal, setShowSubcategoryModal] = useState(false);
  const [selectedCategoryName, setSelectedCategoryName] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const { setSelectedCategory, setSelectedSubcategory } = useCategory();
  const { isDesktop, screenWidth } = useResponsive();
  const { selectedLocation } = useSelectedLocation();
  const [isLocationReady, setIsLocationReady] = useState(false);

  // API state
  const [realCategories, setRealCategories] = useState<Category[]>([]);
  const [realAds, setRealAds] = useState<Ad[]>([]);
  const [recommendedRealAds, setRecommendedRealAds] = useState<Ad[]>([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(true);
  const [isLoadingAds, setIsLoadingAds] = useState(true);
  const [isLoadingRecommended, setIsLoadingRecommended] = useState(false);
  const [platformAds, setPlatformAds] = useState<PlatformAd[]>([]);
  const [isLoadingPlatformAds, setIsLoadingPlatformAds] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Wait for location to be ready
  useEffect(() => {
    // Give a small delay to allow location context to load from AsyncStorage
    const timer = setTimeout(() => {
      setIsLocationReady(true);
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  // Fetch categories and ads when location is ready
  useEffect(() => {
    if (isLocationReady) {
      fetchCategories();
      fetchAds();
      fetchRecommendedAds();
      fetchPlatformAds();
    }
  }, [selectedLocation, isLocationReady, user]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        fetchCategories(),
        fetchAds(),
        fetchRecommendedAds(),
        fetchPlatformAds(),
      ]);
    } catch (error) {
    } finally {
      setIsRefreshing(false);
    }
  };


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

  const fetchCategories = async () => {
    try {
      setIsLoadingCategories(true);
      const response = await categoriesService.getCategories();
      if (response.success && response.data) {
        setRealCategories(response.data);
      }
    } catch (error) {
    } finally {
      setIsLoadingCategories(false);
    }
  };

  const fetchAds = async () => {
    try {
      setIsLoadingAds(true);
      const params: any = {
        page: 1,
        limit: 12,
        sortBy: 'createdAt',
        sortOrder: 'desc'
      };

      // Use coordinate-based proximity search for home page
      if (selectedLocation?.latitude && selectedLocation?.longitude) {
        params.locationLatitude = selectedLocation.latitude;
        params.locationLongitude = selectedLocation.longitude;
        params.locationRadiusKm = 50; // Default 50km radius
      }

      const response = await adsService.getPublicAds(params);
      if (response.success && response.data) {
        setRealAds(Array.isArray(response.data) ? response.data : []);
      } else {
        setRealAds([]);
      }
    } catch (error) {
      setRealAds([]); // Ensure it's always an array on error
    } finally {
      setIsLoadingAds(false);
    }
  };

  const fetchRecommendedAds = async () => {
    try {
      setIsLoadingRecommended(true);
      const response = await adsService.getRecommendedAds({ limit: 8 });
      if (response.success && response.data) {
        setRecommendedRealAds(response.data);
      }
    } catch (error) {
      // Likely unauthorized; ignore and keep fallback
    } finally {
      setIsLoadingRecommended(false);
    }
  };

  const handleAdPress = (adSlug: string) => {
    if (!adSlug || adSlug === 'undefined') {
      return;
    }
    router.push(`/detail/${adSlug}`);
  };

  const { toggleFavorite } = useFavoriteToggle();

  const handleFavorite = async (adId: string) => {
    // Optimistic update
    const toggleAdList = (ads: Ad[]) => ads.map(ad =>
      String(ad.id) === String(adId) ? { ...ad, isFavorite: !ad.isFavorite } : ad
    );
    setRealAds(prev => prev.length > 0 ? toggleAdList(prev) : prev);
    setRecommendedRealAds(prev => prev.length > 0 ? toggleAdList(prev) : prev);

    // Find current state for API call
    const ad = realAds.find(a => String(a.id) === String(adId))
      ?? recommendedRealAds.find(a => String(a.id) === String(adId));
    const wasFavorite = ad?.isFavorite ?? false;

    const success = await toggleFavorite(adId, wasFavorite);
    if (!success) {
      // Revert
      setRealAds(prev => prev.length > 0 ? toggleAdList(prev) : prev);
      setRecommendedRealAds(prev => prev.length > 0 ? toggleAdList(prev) : prev);
    }
  };

  const handleCategoryPress = (category: { id: string; name: string; image: string }) => {
    setSelectedCategoryName(category.name);
    setSelectedCategoryId(category.id);
    setShowSubcategoryModal(true);
  };

  const handleSubcategorySelect = (subcategory: any, categoryName: string) => {
    setSelectedCategory(categoryName);
    setSelectedSubcategory(subcategory);
    // Navigate to posts page with the selected category
    router.push({
      pathname: '/(tabs)/browse',
      params: {
        subcategoryId: subcategory.id,
        subcategoryName: subcategory.name, // Add subcategory name
        category: categoryName,
        categoryId: selectedCategoryId // Pass the category ID as well
      }
    });
  };


  return (
    <ThemedView style={{ flex: 1, paddingTop: isDesktop ? 0 : 80 }}>
      <LocationBanner onPermissionGranted={handleRefresh} />
      <ScrollView
        style={styles.container}
        contentContainerStyle={!isDesktop ? { paddingBottom: TabBar.paddingBottom } : undefined}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            colors={[Colors.light.primary]} // Android
            tintColor={Colors.light.primary} // iOS
          />
        }
      >

        {/* Full-width Hero Section at the top */}
        <HeroSection
          isDesktop={isDesktop}
          ads={[]}
        />

        <View style={isDesktop ? styles.desktopHomeWrapper : null}>
          {isDesktop && (
            <SideBanners
              ads={platformAds.filter(ad => ad.position === PlatformAdPosition.LEFT)}
              position={PlatformAdPosition.LEFT}
            />
          )}

          <View style={isDesktop ? styles.desktopMainContent : null}>
            {/* Categories */}
            {isLoadingCategories ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={Colors.light.primary} />
              </View>
            ) : realCategories.length === 0 ? (
              <View style={styles.emptyState}>
                <MaterialIcons name="category" size={64} color={Colors.light.textSecondary} />
                <ThemedText style={styles.emptyStateTitle}>No categories available</ThemedText>
                <ThemedText style={styles.emptyStateSubtitle}>Check back later for new categories</ThemedText>
              </View>
            ) : (
              <CategoriesSection
                categories={realCategories.map(cat => ({
                  id: cat.id,
                  name: cat.name,
                  image: cat.image || ''
                }))}
                isDesktop={isDesktop}
                onCategoryPress={handleCategoryPress}
              />
            )}

            {!isDesktop && <MobilePlatformBanners ads={platformAds} position="top" style={{ marginTop: 24, paddingHorizontal: 16 }} />}

            {/* Recommended */}
            {(isLoadingRecommended || recommendedRealAds.length > 0) && (
              <ThemedView style={[styles.section, isDesktop && styles.desktopSectionRecommended]}>
                <ThemedView style={[styles.sectionContent, isDesktop && styles.desktopSectionContentRecommended]}>
                  <View style={[styles.sectionHeader, !isDesktop && styles.mobileSectionHeader]}>
                    <View>
                      <ThemedText type="subtitle" style={[styles.sectionTitle, !isDesktop && styles.mobileSectionTitle, isDesktop && styles.desktopSectionTitle]}>Recommended for You</ThemedText>
                      {isDesktop && (
                        <ThemedText style={styles.sectionSubtitle}>Handpicked items based on your interests</ThemedText>
                      )}
                    </View>
                    <Pressable style={styles.seeAllButton} onPress={() => router.push('/(tabs)/browse')}>
                      <ThemedText style={styles.seeAllText}>Browse All</ThemedText>
                      <MaterialIcons name="arrow-forward-ios" size={12} color={Colors.light.primary} />
                    </Pressable>
                  </View>
                </ThemedView>
                <ThemedView style={[styles.adsGrid, isDesktop && styles.desktopRecommendedAdsGrid]}>
                  {isLoadingRecommended ? (
                    <View style={styles.loadingContainer}>
                      <ActivityIndicator size="large" color={Colors.light.primary} />
                    </View>
                  ) : (
                    recommendedRealAds.map((ad: any) => (
                      <AdCard
                        key={ad.id}
                        id={String(ad.id)}
                        slug={ad.slug || `ad-${ad.id}`}
                        title={ad.title}
                        location={ad.locationFormatted || ad.locationCity || 'Location'}
                        price={!shouldHidePrice(ad.price) ? formatPrice(ad.price) : ''}
                        discountedPrice={ad.discountedPrice && !shouldHidePrice(ad.discountedPrice) ? formatPrice(ad.discountedPrice) : undefined}
                        image={ad.images?.[0]}
                        publisherName={ad.user ? `${ad.user.firstName}${ad.user.lastName ? ' ' + ad.user.lastName : ''}` : undefined}
                        category={ad.category?.name}
                        subcategory={ad.subcategory?.name}
                        categoryPlaceholder={ad.category?.adPlaceholder}
                        status={ad.status}
                        onPress={handleAdPress}
                        onFavorite={handleFavorite}
                        isFavorite={ad.isFavorite || false}
                        containerStyle={isDesktop ? styles.desktopAdCard : { width: (width - 40) / 2 - 8 }}
                      />
                    ))
                  )}
                </ThemedView>
              </ThemedView>
            )}

            {/* Why Choose Us - Desktop Only */}
            {isDesktop && (
              <ThemedView style={[styles.desktopSectionFeatures, styles.featuresSection]}>
                <ThemedView style={styles.desktopSectionContent}>
                  <View style={styles.sectionHeader}>
                    <View>
                      <ThemedText type="subtitle" style={[styles.sectionTitle, !isDesktop && styles.mobileSectionTitle, isDesktop && styles.desktopSectionTitle]}>Why Choose Us</ThemedText>
                      <ThemedText style={styles.sectionSubtitle}>Your trusted local marketplace for buying and selling</ThemedText>
                    </View>
                  </View>
                </ThemedView>
                <View style={styles.featuresGrid}>
                  {features.map((feature, index) => (
                    <View key={index} style={styles.featureCard}>
                      <View style={styles.featureIconWrapper}>
                        <MaterialIcons name={feature.icon as any} size={40} color="#CC1614" />
                      </View>
                      <ThemedText style={styles.featureTitle}>{feature.title}</ThemedText>
                      <ThemedText style={styles.featureDescription}>{feature.description}</ThemedText>
                    </View>
                  ))}
                </View>
              </ThemedView>
            )}
          </View>

          {isDesktop && (
            <SideBanners
              ads={platformAds.filter(ad => ad.position === PlatformAdPosition.RIGHT)}
              position={PlatformAdPosition.RIGHT}
            />
          )}
        </View>

        {!isDesktop && <MobilePlatformBanners ads={platformAds} position="bottom" style={{ marginBottom: 24, paddingHorizontal: 16 }} />}

        {/* Full-width Footer at the bottom */}
        <Footer />
      </ScrollView>

      <SubcategoryModal
        visible={showSubcategoryModal}
        onClose={() => setShowSubcategoryModal(false)}
        onSelectSubcategory={handleSubcategorySelect}
        categoryName={selectedCategoryName}
        categoryId={selectedCategoryId}
      />
    </ThemedView>
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
    // We allow wrapper to be 100% so backgrounds can spread,
    // but we use SideBanners with relative positioning to the boxed content
  },
  desktopMainContent: {
    width: '100%',
    maxWidth: 1000,
    position: 'relative',
  },
  // Section
  section: {
    paddingTop: 20,
    paddingBottom: 16,
  },
  sectionContent: {
    paddingHorizontal: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 40,
  },
  mobileSectionHeader: {
    marginBottom: 16, // Reduced spacing for mobile
  },
  sectionTitle: {
    color: '#000000',
    fontSize: 24, // Default for mobile
    fontWeight: '700',
    marginBottom: 8, // Consistent spacing with subtitle
  },
  mobileSectionTitle: {
    fontSize: 18, // Smaller size for mobile
  },
  desktopSectionTitle: {
    fontSize: 28, // Larger for desktop
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 0, // Title already has marginBottom
  },
  // Ads Grid
  adsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },

  // Desktop Styles
  desktopSection: {
    paddingTop: 80,
    paddingBottom: 80,
  },
  desktopSectionFeatures: {
    paddingTop: 70,
    paddingBottom: 70,
  },
  desktopSectionContent: {
    paddingHorizontal: 40,
    maxWidth: 1000,
    width: '100%',
    alignSelf: 'center',
  },
  desktopAdsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 24,
    paddingHorizontal: 40,
    paddingBottom: 100,
    maxWidth: 1000,
    width: '100%',
    alignSelf: 'center',
    justifyContent: 'space-between',
  },
  desktopAdCard: {
    width: '23%',
  },

  // Featured Section Styles
  desktopFeaturedGrid: {
    flexDirection: 'row',
    gap: 24,
    paddingHorizontal: 40,
    maxWidth: 1000,
    width: '100%',
    alignSelf: 'center',
    justifyContent: 'space-between',
  },
  featuredCard: {
    width: '31.5%',
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    boxShadow: WebShadows.medium,
    ...Platform.select({
      web: {
        boxShadow: WebShadows.medium,
      },
      default: {
        elevation: 1,
        shadowColor: 'rgba(0, 0, 0, 0.08)',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
      },
    }),
  },
  featuredImageWrapper: {
    position: 'relative',
    width: '100%',
    height: 300,
  },
  featuredImage: {
    width: '100%',
    height: '100%',
  },
  featuredGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '70%',
  },
  featuredBadge: {
    position: 'absolute',
    top: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 4,
  },
  featuredBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  featuredContent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
  },
  featuredTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  featuredDescription: {
    fontSize: 14,
    color: '#FFFFFF',
    opacity: 0.9,
    marginBottom: 12,
  },
  featuredFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  featuredLocation: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  featuredLocationText: {
    fontSize: 13,
    color: '#FFFFFF',
    opacity: 0.9,
  },
  featuredPrice: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Features Section Styles
  featuresSection: {
    backgroundColor: '#FEFEFE',
    paddingBottom: 100,
  },
  featuresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 24,
    paddingHorizontal: 40,
    maxWidth: 1000,
    width: '100%',
    alignSelf: 'center',
    justifyContent: 'space-between',
  },
  featureCard: {
    width: '23%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    shadowColor: 'rgba(0, 0, 0, 0.1)',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 1,
  },
  featureIconWrapper: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FEF2F2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  featureTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000',
    marginBottom: 8,
    textAlign: 'center',
  },
  featureDescription: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },

  // Loading Styles
  loadingContainer: {
    width: '100%',
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: Colors.light.textSecondary,
  },

  // See All Button Styles (for Recommended section)
  seeAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  seeAllText: {
    fontSize: 14,
    color: Colors.light.primary,
    fontWeight: '600',
  },
  filterBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  filterTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 8,
  },
  filterButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },

  // Custom styles for Recommended section to reduce padding
  desktopSectionRecommended: {
    paddingTop: 40, // Increased to provide better spacing after categories
    paddingBottom: 30, // Adjusted for better spacing
  },
  desktopSectionContentRecommended: {
    paddingHorizontal: 40,
    maxWidth: 1000,
    width: '100%',
    alignSelf: 'center',
  },
  desktopRecommendedAdsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 24,
    paddingHorizontal: 40,
    paddingBottom: 20, // Reduced from 100 to 20
    maxWidth: 1000,
    width: '100%',
    alignSelf: 'center',
    justifyContent: 'space-between',
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.light.text,
    marginTop: 12,
    textAlign: 'center',
  },
  emptyStateSubtitle: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    marginTop: 4,
    textAlign: 'center',
  },
});
