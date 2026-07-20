import { MaterialIcons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Dimensions, ScrollView, StyleSheet, Pressable, View, ActivityIndicator, Platform } from 'react-native';
import { NetworkImage } from '@/components/ui/network-image';
import { useAlert } from '@/components/ui/custom-alert';
import { AdCard } from '@/components/ad-card';
import { Header } from '@/components/header';
import { Footer } from '@/components/footer';
import { MobilePlatformBanners } from '@/components/mobile-platform-banners';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { HEADER_HEIGHT } from '@/constants/layout';
import { formatPrice, shouldHidePrice } from '@/utils/price-formatter';
import { useResponsive } from '@/hooks/use-responsive';
import { useFavoriteToggle } from '@/hooks/use-favorite-toggle';
import { userService, platformAdsService } from '@/services';
import type { Ad, User, PlatformAd } from '@/types/api.types';
import { PlatformAdPosition } from '@/types/api.types';
import { UserNotFound404 } from '@/components/ui/user-not-found-404';
import { useAuth } from '@/contexts/auth-context';
import { useAuthGuard } from '@/utils/auth-guard';
import { SideBanners } from '@/components/home/side-banners';

const { width } = Dimensions.get('window');

export default function UserScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [user, setUser] = useState<User | null>(null);
  const [ads, setAds] = useState<Ad[]>([]);
  const [loading, setLoading] = useState(true);
  const [adsLoading, setAdsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const { isDesktop, screenWidth } = useResponsive();
  const { showAlert } = useAlert();
  const { isAuthenticated, isLoading: isAuthLoading, setLoginModalVisible } = useAuth();
  const { checkAuthAndRedirect } = useAuthGuard();
  const { toggleFavorite } = useFavoriteToggle();
  const [platformAds, setPlatformAds] = useState<PlatformAd[]>([]);
  const [isLoadingPlatformAds, setIsLoadingPlatformAds] = useState(true);

  // Check authentication on mount — skip while auth is still loading to avoid
  // a race where checkAuth() hasn't resolved yet and isAuthenticated is still false.
  useEffect(() => {
    if (isAuthLoading) return;
    if (!isAuthenticated) {
      if (isDesktop) {
        // Show login modal on desktop
        setLoginModalVisible(true);
      } else {
        // Redirect to login on mobile
        checkAuthAndRedirect();
      }
    }
  }, [isAuthenticated, isAuthLoading, isDesktop]);

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
    const userId = params.id as string;
    if (!userId) return;
    if (!isAuthenticated) return; // Don't fetch if not authenticated

    fetchUser(userId);
    fetchUserAds(userId);
  }, [params.id, isAuthenticated]);

  const fetchUser = async (userId: string) => {
    try {
      const response = await userService.getUserById(userId);
      if (response.success && response.data) {
        setUser(response.data);
        setNotFound(false); // Reset notFound state when user is found
      } else {
        setNotFound(true);
      }
      setLoading(false);
    } catch (e) {
      setNotFound(true);
      setLoading(false);
    }
  };

  const fetchUserAds = async (userId: string) => {
    try {
      setAdsLoading(true);
      const response = await userService.getUserAds(userId, { page: 1, limit: 20 });
      if (response.success && response.data) {
        setAds(Array.isArray(response.data) ? response.data : response.data.data || []);
        // Mark which ads are in the user's wishlist
        fetchFavorites();
      }
    } catch (e) {
      showAlert({
        title: "Error",
        message: "Failed to load user ads",
        type: "error"
      });
    } finally {
      setAdsLoading(false);
    }
  };
  const fetchFavorites = async () => {
    try {
      const response = await userService.getWishlist({ limit: 200 });
      if (response.success && response.data) {
        const favoriteIds = new Set(response.data.map(item => String(item.adId)));
        setAds(prev => prev.map(ad => ({
          ...ad,
          isFavorite: favoriteIds.has(String(ad.id))
        })));
      }
    } catch (error) {
      // Silently ignore — favorites are non-critical
    }
  };


  const handleAdPress = (adSlug: string) => {
    router.push(`/(pages)/detail/${adSlug}`);
  };

  const handleFavorite = async (adId: string) => {
    const ad = ads.find(a => String(a.id) === String(adId));
    if (!ad) return;
    const wasFavorite = ad.isFavorite ?? false;

    // Optimistic update
    setAds(prev => prev.map(a =>
      String(a.id) === String(adId) ? { ...a, isFavorite: !wasFavorite } : a
    ));

    const success = await toggleFavorite(adId, wasFavorite);
    if (!success) {
      // Revert
      setAds(prev => prev.map(a =>
        String(a.id) === String(adId) ? { ...a, isFavorite: wasFavorite } : a
      ));
    }
  };


  if (isAuthLoading) {
    return (
      <ThemedView style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={Colors.light.primary} />
      </ThemedView>
    );
  }

  if (!isAuthenticated) {
    // Auth confirmed: not logged in (login modal/redirect already triggered by useEffect)
    return null;
  }

  if (loading) {
    return (
      <ThemedView style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={Colors.light.primary} />
      </ThemedView>
    );
  }

  if (notFound) {
    return (
      <ThemedView style={{ flex: 1 }}>
        {isDesktop ? null : <Header />}
        <UserNotFound404 />
        <Footer />
      </ThemedView>
    );
  }

  // Mobile View
  const mobileView = (
    <>
      <Header />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <MobilePlatformBanners ads={platformAds} position="top" style={{ marginVertical: 8, paddingHorizontal: 16 }} />

        {/* User Header */}
        <ThemedView style={styles.userHeader}>
          <View style={styles.userAvatarContainer}>
            {user?.avatar ? (
              <NetworkImage source={{ uri: user.avatar }} style={styles.userAvatarImage} />
            ) : (
              <ThemedText style={styles.userAvatar}>
                {user?.firstName?.charAt(0)?.toUpperCase() || 'U'}
              </ThemedText>
            )}
          </View>
          <ThemedView style={styles.userInfo}>
            <ThemedText style={styles.userName}>
              {user?.firstName} {user?.lastName || ''}
            </ThemedText>

          </ThemedView>
        </ThemedView>


        {/* User Ads */}
        <ThemedView style={styles.section}>
          <ThemedView style={styles.sectionContent}>
            <ThemedText type="subtitle" style={styles.sectionTitle}>
              Ads by this user
            </ThemedText>
          </ThemedView>
          
          {adsLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={Colors.light.primary} />
            </View>
          ) : ads.length === 0 ? (
            <ThemedView style={styles.noAdsContainer}>
              <MaterialIcons name="info-outline" size={48} color={Colors.light.textSecondary} />
              <ThemedText style={styles.noAdsText}>No ads published by this user</ThemedText>
            </ThemedView>
          ) : (
            <View style={styles.adsContainer}>
              {ads.map((ad) => (
                <Pressable
                  key={ad.id}
                  onPress={() => handleAdPress(ad.slug)}
                  
                  style={styles.adCardWrapper}
                >
                  <AdCard
                    id={ad.id}
                    slug={ad.slug}
                    title={ad.title}
                    description={ad.description}
                    location={ad.locationFormatted || ad.locationCity || 'Location'}
                    price={!shouldHidePrice(ad.price) ? formatPrice(ad.price) : ''}
                    image={ad.images?.[0]}
                    category={ad.category?.name}
                    subcategory={ad.subcategory?.name}
                    categoryPlaceholder={ad.category?.adPlaceholder}
                    status={ad.status}
                    onPress={() => handleAdPress(ad.slug)}
                    onFavorite={handleFavorite}
                    isFavorite={ad.isFavorite || false}
                  />
                </Pressable>
              ))}
            </View>
          )}
        </ThemedView>
        <MobilePlatformBanners ads={platformAds} position="bottom" style={{ marginTop: 8, marginBottom: 24, paddingHorizontal: 16 }} />
        <Footer />
      </ScrollView>
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
              {/* User Header */}
              <View style={desktopStyles.userHeader}>
                <View style={desktopStyles.userAvatarContainer}>
                  {user?.avatar ? (
                    <NetworkImage source={{ uri: user.avatar }} style={desktopStyles.userAvatarImage} />
                  ) : (
                    <ThemedText style={desktopStyles.userAvatar}>
                      {user?.firstName?.charAt(0)?.toUpperCase() || 'U'}
                    </ThemedText>
                  )}
                </View>
                <View style={desktopStyles.userInfo}>
                  <ThemedText style={desktopStyles.userName}>
                    {user?.firstName} {user?.lastName || ''}
                  </ThemedText>

                </View>
              </View>


              {/* User Ads */}
              <View style={desktopStyles.section}>
                <ThemedText style={desktopStyles.sectionTitle}>
                  Ads by this user
                </ThemedText>
                
                {adsLoading ? (
                  <View style={desktopStyles.loadingContainer}>
                    <ActivityIndicator size="large" color={Colors.light.primary} />
                  </View>
                ) : ads.length === 0 ? (
                  <View style={desktopStyles.noAdsContainer}>
                    <MaterialIcons name="info-outline" size={48} color={Colors.light.textSecondary} />
                    <ThemedText style={desktopStyles.noAdsText}>No ads published by this user</ThemedText>
                  </View>
                ) : (
                  <View style={desktopStyles.adsContainer}>
                    {ads.map((ad) => (
                      <Pressable
                        key={ad.id}
                        onPress={() => handleAdPress(ad.slug)}
                        
                        style={desktopStyles.adCardWrapper}
                      >
                        <AdCard
                          id={ad.id}
                          slug={ad.slug}
                          title={ad.title}
                          description={ad.description}
                          location={ad.locationFormatted || ad.locationCity || 'Location'}
                          price={!shouldHidePrice(ad.price) ? formatPrice(ad.price) : ''}
                          image={ad.images?.[0]}
                          status={ad.status}
                          onPress={() => handleAdPress(ad.slug)}
                          onFavorite={handleFavorite}
                          isFavorite={ad.isFavorite || false}
                        />
                      </Pressable>
                    ))}
                  </View>
                )}
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
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 20,
    paddingTop: HEADER_HEIGHT,
  },
  // User Header
  userHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFFFFF',
    // borderBottomWidth: 1,
    // borderBottomColor: Colors.light.backgroundSecondary,
  },
  userAvatarContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: Colors.light.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    overflow: 'hidden',
  },
  userAvatarImage: {
    width: 50,
    height: 50,
  },
  userAvatar: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
  },
  userAdsCount: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    marginTop: 2,
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
  },
  // Ads
  loadingContainer: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  noAdsContainer: {
    padding: 40,
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    marginHorizontal: 20,
  },
  noAdsText: {
    fontSize: 16,
    color: Colors.light.textSecondary,
    marginTop: 12,
    textAlign: 'center',
  },
  adsContainer: {
    paddingHorizontal: 20,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  adCardWrapper: {
    width: (width - 52) / 2,
  },
});

// Desktop Styles
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
  content: {
    maxWidth: 1000,
    width: '100%',
    marginHorizontal: 'auto',
    padding: 32,
  },
  // User Header
  userHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E9ECEF',
    borderRadius: 12,
    marginBottom: 24,
  },
  userAvatarContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.light.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    overflow: 'hidden',
  },
  userAvatarImage: {
    width: 60,
    height: 60,
  },
  userAvatar: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.light.text,
  },
  userAdsCount: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    marginTop: 4,
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
  // Ads
  loadingContainer: {
    paddingVertical: 80,
    alignItems: 'center',
  },
  noAdsContainer: {
    padding: 60,
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    border: '1px solid #E9ECEF',
  },
  noAdsText: {
    fontSize: 18,
    color: Colors.light.textSecondary,
    marginTop: 16,
    textAlign: 'center',
  },
  adsContainer: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: 20,
  },
  adCardWrapper: {
    width: '100%',
  },
});