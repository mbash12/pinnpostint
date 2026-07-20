import { MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, ActivityIndicator, Text, Pressable, Platform } from 'react-native';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { AdCard } from '@/components/ad-card';
import { SearchBar } from '@/components/search-bar';
import { adsService, platformAdsService } from '@/services';
import { Colors } from '@/constants/theme';
import { HEADER_HEIGHT } from '@/constants/layout';
import { formatPrice, shouldHidePrice } from '@/utils/price-formatter';
import { useBackNavigation, FALLBACK_ROUTES } from '@/utils/navigation-helpers';
import { useResponsive } from '@/hooks/use-responsive';
import { useFavoriteToggle } from '@/hooks/use-favorite-toggle';
import { SideBanners } from '@/components/home/side-banners';
import { PlatformAd, PlatformAdPosition } from '@/types/api.types';
import { Footer } from '@/components/footer';
import { MobilePlatformBanners } from '@/components/mobile-platform-banners';

export default function SearchResultsPage() {
  const router = useRouter();
  const { goBack } = useBackNavigation(FALLBACK_ROUTES.SEARCH_RESULTS);
  const { query } = useLocalSearchParams<{ query: string }>();
  const [searchQuery, setSearchQuery] = useState(query || '');
  const [ads, setAds] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const { isDesktop, screenWidth } = useResponsive();
  const { toggleFavorite } = useFavoriteToggle();
  const [platformAds, setPlatformAds] = useState<PlatformAd[]>([]);
  const [isLoadingPlatformAds, setIsLoadingPlatformAds] = useState(true);

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
    if (searchQuery) {
      searchAds(searchQuery, 1);
    }
  }, []);

  const searchAds = async (q: string, pageNum: number) => {
    if (!q.trim()) return;
    
    setLoading(true);
    try {
      const response = await adsService.getPublicAds({
        page: pageNum,
        limit: 20,
        search: q.trim(),
      });
      
      if (response.success && response.data) {
        if (pageNum === 1) {
          setAds(response.data.ads);
        } else {
          setAds(prev => [...prev, ...response.data.ads]);
        }
        setHasMore(response.data.ads.length === 20);
        setPage(pageNum);
      }
    } catch (error) {
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    if (searchQuery.trim()) {
      searchAds(searchQuery, 1);
    }
  };

  const handleLoadMore = () => {
    if (!loading && hasMore) {
      searchAds(searchQuery, page + 1);
    }
  };

  const handleAdPress = (id: string, slug: string) => {
    router.push(`/(pages)/detail/${slug}`);
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

  return (
    <ThemedView style={styles.container}>
      {!isDesktop && <MobilePlatformBanners ads={platformAds} position="top" style={{ marginVertical: 8, paddingHorizontal: 16 }} />}
      <View style={isDesktop ? styles.desktopHomeWrapper : null}>
        {isDesktop && (
          <SideBanners 
            ads={platformAds.filter(ad => ad.position === PlatformAdPosition.LEFT)} 
            position={PlatformAdPosition.LEFT} 
          />
        )}

        <View style={isDesktop ? styles.desktopMainContent : { flex: 1 }}>
          {/* Header */}
          <View style={styles.header}>
            <Pressable onPress={goBack} style={styles.backButton}>
              <MaterialIcons name="arrow-back" size={24} color={Colors.light.text} />
            </Pressable>
            <ThemedText style={styles.headerTitle}>Search Results</ThemedText>
          </View>

          {/* Search Bar */}
          <View style={styles.searchWrapper}>
            <SearchBar
              value={searchQuery}
              onChangeText={setSearchQuery}
              onClear={() => setSearchQuery('')}
              placeholder="Search for ads..."
              showFilter={false}
              containerStyle={styles.searchContainer}
            />
            <Pressable style={styles.searchButton} onPress={handleSearch}>
              <MaterialIcons name="search" size={24} color="#FFFFFF" />
            </Pressable>
          </View>

          {/* Results */}
          {loading && page === 1 ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={Colors.light.primary} />
            </View>
          ) : ads.length === 0 ? (
            <View style={styles.emptyContainer}>
              <MaterialIcons name="search-off" size={64} color={Colors.light.textSecondary} />
              <ThemedText style={styles.emptyText}>No results found</ThemedText>
              <ThemedText style={styles.emptySubtext}>Try different keywords</ThemedText>
            </View>
          ) : (
            <FlatList
              data={ads}
              keyExtractor={(item) => item.id.toString()}
              renderItem={({ item }) => (
                <AdCard
                  id={String(item.id)}
                  slug={item.slug || `ad-${item.id}`}
                  title={item.title}
                  location={item.location?.name || 'Location'}
                  price={!shouldHidePrice(item.price) ? formatPrice(item.price) : ''}
                  discountedPrice={item.discountedPrice && !shouldHidePrice(item.discountedPrice) ? formatPrice(item.discountedPrice) : undefined}
                  image={item.images?.[0]}
                  publisherName={item.user ? `${item.user.firstName}${item.user.lastName ? ' ' + item.user.lastName : ''}` : undefined}
                  category={item.category?.name}
                  subcategory={item.subcategory?.name}
                  categoryPlaceholder={item.category?.adPlaceholder}
                  status={item.status}
                  onPress={handleAdPress}
                  onFavorite={handleFavorite}
                  isFavorite={item.isFavorite || false}
                  containerStyle={styles.adCard}
                />
              )}
              contentContainerStyle={styles.listContent}
              onEndReached={handleLoadMore}
              onEndReachedThreshold={0.5}
              ListFooterComponent={
                <>
                  {loading && page > 1 ? (
                    <ActivityIndicator size="small" color={Colors.light.primary} style={styles.footerLoader} />
                  ) : null}
                  {!isDesktop && <MobilePlatformBanners ads={platformAds} position="bottom" />}
                  <Footer />
                </>
              }
            />
          )}
        </View>

        {isDesktop && (
          <SideBanners 
            ads={platformAds.filter(ad => ad.position === PlatformAdPosition.RIGHT)} 
            position={PlatformAdPosition.RIGHT} 
          />
        )}
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: HEADER_HEIGHT,
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.backgroundSecondary,
  },
  backButton: {
    marginRight: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
  },
  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    gap: 12,
  },
  searchContainer: {
    flex: 1,
    paddingHorizontal: 0,
    paddingBottom: 0,
  },
  searchButton: {
    width: 50,
    height: 50,
    backgroundColor: Colors.light.primary,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    marginTop: 8,
  },
  listContent: {
    padding: 20,
  },
  adCard: {
    marginBottom: 16,
  },
  footerLoader: {
    marginVertical: 20,
  },
});
