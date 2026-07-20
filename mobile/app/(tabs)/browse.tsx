import { MaterialIcons } from '@expo/vector-icons';
import { StyleSheet, ScrollView, Dimensions, Platform, View, Pressable, ActivityIndicator, RefreshControl, Linking } from 'react-native';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { AdCard } from '@/components/ad-card';
import { Footer } from '@/components/footer';
import { MobilePlatformBanners } from '@/components/mobile-platform-banners';
import { SearchBar, type SearchBarRef } from '@/components/search-bar';
import { PaginationControls } from '@/components/ui/pagination';
import { DesktopFilters, type DesktopFilterOptions } from '@/components/ui/desktop-filters';
import { adsService, platformAdsService } from '@/services';
import type { Ad, PlatformAd } from '@/types/api.types';
import { PlatformAdPosition } from '@/types/api.types';
import { formatPrice, shouldHidePrice } from '@/utils/price-formatter';
import { Colors, TabBar } from '@/constants/theme';
import { SideBanners } from '@/components/home/side-banners';
import { NetworkImage } from '@/components/ui/network-image';
import { useResponsive } from '@/hooks/use-responsive';
import { useFilter } from '@/hooks/use-filter';
import { useFavoriteToggle } from '@/hooks/use-favorite-toggle';
import { LocationBanner } from '@/components/location-banner';

export default function BrowseScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const searchInputRef = useRef<SearchBarRef>(null);
  const hasFocusedSearchRef = useRef(false);
  const debounceTimerRef = useRef<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredPosts, setFilteredPosts] = useState<Ad[]>([]);
  const { isDesktop, screenWidth } = useResponsive();
  const { handleResetFilters: resetFilterContext, syncMobileParams } = useFilter();
  const [isLoading, setIsLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<any>(null);
  const [platformAds, setPlatformAds] = useState<PlatformAd[]>([]);
  const [desktopFilters, setDesktopFilters] = useState<DesktopFilterOptions>({
    category: 'All Categories',
    categoryId: undefined,
    subcategoryId: undefined,
    subcategoryName: undefined,
    priceRange: { min: '', max: '' },
    location: undefined,
    locationName: '',
    locationLatitude: undefined,
    locationLongitude: undefined,
    sortBy: 'Most Recent'
  });

  const fetchPlatformAds = async () => {
    try {
      const response = await platformAdsService.getPlatformAds();
      if (response.success && response.data) {
        setPlatformAds(response.data);
      }
    } catch (error) {
    }
  };

  const openPlatformAdUrl = (url: string | undefined) => {
    if (!url) return;
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.open(url, '_blank');
    } else if (Platform.OS !== 'web') {
      Linking.openURL(url).catch(() => {});
    }
  };

  const topPlatformAds = platformAds.filter((ad) => ad.position === PlatformAdPosition.TOP);
  const bottomPlatformAds = platformAds.filter((ad) => ad.position === PlatformAdPosition.BOTTOM);

  useEffect(() => {
    fetchPlatformAds();
  }, []);

  // Create a stable filter key from URL params - includes subcategoryId for proper re-fetching
  const filterKey = JSON.stringify({
    minPrice: params.minPrice || undefined,
    maxPrice: params.maxPrice || undefined,
    locationLatitude: params.locationLatitude || undefined,
    locationLongitude: params.locationLongitude || undefined,
    categoryId: params.categoryId || undefined,
    subcategoryId: params.subcategoryId || undefined,
    sortBy: params.sortBy || undefined,
    search: params.search || undefined
  });

  const fetchPosts = useCallback(async (pageNum: number = 1, overrideSearch: string | null | undefined = undefined) => {
    try {
      setIsLoading(true);

      const requestParams: any = {
        page: pageNum,
        limit: 12,
        search: overrideSearch === null ? undefined : (overrideSearch !== undefined ? overrideSearch : ((params.search as string) || undefined)),
        sortOrder: 'desc',
      };

      // Apply filters directly from URL params
      if (params.minPrice) {
        requestParams.minPrice = parseInt(params.minPrice as string);
      }
      if (params.maxPrice) {
        requestParams.maxPrice = parseInt(params.maxPrice as string);
      }
      // Use proximity search parameters instead of locationId
      if (params.locationLatitude && params.locationLongitude) {
        requestParams.locationLatitude = parseFloat(params.locationLatitude as string);
        requestParams.locationLongitude = parseFloat(params.locationLongitude as string);
        requestParams.locationRadiusKm = 50; // Default 50km radius
      }
      if (params.categoryId) {
        requestParams.categoryId = params.categoryId;
      }
      if (params.subcategoryId) {
        requestParams.subcategoryId = params.subcategoryId;
      }
      if (params.sortBy) {
        const sortByMap: { [key: string]: string } = {
          'Most Recent': 'createdAt',
          'Price: Low to High': 'price',
          'Price: High to Low': 'price',
          'Title': 'title'
        };

        const mappedSortBy = sortByMap[params.sortBy as string] || 'createdAt';
        requestParams.sortBy = mappedSortBy;

        if (params.sortBy === 'Price: Low to High') {
          requestParams.sortOrder = 'asc';
        } else if (params.sortBy === 'Price: High to Low') {
          requestParams.sortOrder = 'desc';
        } else {
          requestParams.sortOrder = 'desc';
        }
      } else {
        requestParams.sortBy = 'createdAt';
        requestParams.sortOrder = 'desc';
      }

      const response = await adsService.getPublicAds(requestParams);
      if (response.success && response.data) {
        const newData = Array.isArray(response.data) ? response.data : (response.data as any).ads || [];
        setFilteredPosts(newData);
        setPagination(response.pagination);
        setPage(pageNum);
      } else {
        setFilteredPosts([]);
        setPagination(null);
      }
    } catch (e) {
      setFilteredPosts([]);
      setPagination(null);
    } finally {
      setIsLoading(false);
    }
  }, [filterKey]); // Only depend on filterKey

  // Sync desktop filters with URL params - avoid causing double fetches
  useEffect(() => {
    if (isDesktop) {
      setDesktopFilters({
        category: (params.category as string) || 'All Categories',
        categoryId: params.categoryId ? params.categoryId as string : undefined,
        subcategoryId: params.subcategoryId ? params.subcategoryId as string : undefined,
        subcategoryName: params.subcategoryName ? params.subcategoryName as string : undefined,
        priceRange: {
          min: (params.minPrice as string) || '',
          max: (params.maxPrice as string) || ''
        },
        location: (params.locationLatitude && params.locationLongitude) ? {
          latitude: parseFloat(params.locationLatitude as string),
          longitude: parseFloat(params.locationLongitude as string),
          displayName: (params.locationName as string) || '',
          address: {
            country: '',
            formatted: (params.locationName as string) || ''
          }
        } : undefined,
        locationName: (params.locationName as string) || '',
        locationLatitude: params.locationLatitude ? parseFloat(params.locationLatitude as string) : undefined,
        locationLongitude: params.locationLongitude ? parseFloat(params.locationLongitude as string) : undefined,
        sortBy: (params.sortBy as string) || 'Most Recent'
      });
    }
  }, [
    isDesktop,
    JSON.stringify({
      category: params.category,
      categoryId: params.categoryId,
      subcategoryId: params.subcategoryId,
      subcategoryName: params.subcategoryName,
      minPrice: params.minPrice,
      maxPrice: params.maxPrice,
      locationLatitude: params.locationLatitude,
      locationLongitude: params.locationLongitude,
      locationName: params.locationName,
      sortBy: params.sortBy
    })
  ]);

  const handleDesktopFiltersChange = (filters: DesktopFilterOptions) => {
    setDesktopFilters(filters);

    // Build a fresh params object to ensure cleared filters are removed from URL
    const newParams: any = {};
    
    // Use the local state as the source of truth for search, not the URL params
    if (searchQuery && searchQuery.trim()) {
      newParams.search = searchQuery.trim();
    }

    if (filters.priceRange.min) {
      newParams.minPrice = filters.priceRange.min;
    }
    
    if (filters.priceRange.max) {
      newParams.maxPrice = filters.priceRange.max;
    }
    
    if (filters.locationLatitude !== undefined && filters.locationLongitude !== undefined) {
      newParams.locationLatitude = filters.locationLatitude;
      newParams.locationLongitude = filters.locationLongitude;
      newParams.locationName = filters.locationName;
    }
    
    if (filters.sortBy && filters.sortBy !== 'Most Recent') {
      newParams.sortBy = filters.sortBy;
    }

    if (filters.categoryId) {
      newParams.categoryId = filters.categoryId;
      newParams.category = filters.category;
      if (filters.subcategoryId) {
        newParams.subcategoryId = filters.subcategoryId;
        newParams.subcategoryName = filters.subcategoryName;
      }
    }

    // Use replace to ensure the URL exactly matches our filter state
    router.replace({
      pathname: '/(tabs)/browse',
      params: newParams
    });
  };

  const handleDesktopFiltersReset = () => {
    setDesktopFilters({
      category: 'All Categories',
      categoryId: undefined,
      subcategoryId: undefined,
      subcategoryName: undefined,
      priceRange: { min: '', max: '' },
      location: undefined,
      locationName: '',
      locationLatitude: undefined,
      locationLongitude: undefined,
      sortBy: 'Most Recent'
    });

    setSearchQuery('');
    // Use replace to completely clear the URL including all search params
    router.replace('/(tabs)/browse');
  };

  // Responsive grid configuration
  const GRID_COLUMNS = isDesktop ? 4 : 2;
  const ITEM_WIDTH = isDesktop ? 280 : (screenWidth - 40) / GRID_COLUMNS - 8;

  // Initialize search query from URL parameters
  useEffect(() => {
    const searchFromUrl = params.search as string;
    if (searchFromUrl && searchFromUrl !== searchQuery) {
      setSearchQuery(searchFromUrl);
    }
  }, [params.search]);

  // Sync browse params to global filter context on mobile
  // This ensures the filter sheet can see active filters even when opened from other screens
  useEffect(() => {
    if (Platform.OS !== 'web') {
      syncMobileParams({
        category: params.category as string,
        categoryId: params.categoryId as string,
        subcategoryId: params.subcategoryId as string,
        subcategoryName: params.subcategoryName as string,
        minPrice: params.minPrice as string,
        maxPrice: params.maxPrice as string,
        locationName: params.locationName as string,
        locationLatitude: params.locationLatitude as string,
        locationLongitude: params.locationLongitude as string,
        sortBy: params.sortBy as string,
      });
    }
  }, [
    params.category,
    params.categoryId,
    params.subcategoryId,
    params.subcategoryName,
    params.minPrice,
    params.maxPrice,
    params.locationName,
    params.locationLatitude,
    params.locationLongitude,
    params.sortBy
  ]);

  // Focus search input when focusSearch param is present (from header search button)
  useEffect(() => {
    const shouldFocusSearch = params.focusSearch === 'true';
    if (shouldFocusSearch && searchInputRef.current && !isDesktop && !hasFocusedSearchRef.current) {
      // Mark as handled to prevent infinite loop
      hasFocusedSearchRef.current = true;

      // Clear the focusSearch parameter from URL after focusing
      router.setParams({ focusSearch: undefined });

      // Focus the input after a small delay to ensure the component is mounted
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }

    // Reset the flag when focusSearch parameter is no longer present
    if (!shouldFocusSearch) {
      hasFocusedSearchRef.current = false;
    }
  }, [params.focusSearch, isDesktop, router]);

  // Fetch posts when filterKey changes (URL params change)
  useEffect(() => {
    setPage(1);
    fetchPosts(1);
  }, [filterKey]);

  // Sync search query and fetch when screen comes into focus (navigating back)
  useFocusEffect(
    useCallback(() => {
      // Always sync search query with URL param when screen is focused
      const searchFromUrl = params.search as string;
      setSearchQuery(searchFromUrl || '');
      // Fetch fresh data based on current URL
      fetchPosts(1);
    }, [fetchPosts, params.search])
  );

  const handleSearch = (query: string) => {
    setSearchQuery(query);

    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Debounce URL update
    debounceTimerRef.current = setTimeout(() => {
      setPage(1);
      // Always update URL - empty query clears search param
      if (query && query.trim()) {
        router.setParams({ search: query.trim() });
      } else {
        router.setParams({ search: undefined });
        // Immediately fetch with null search to ensure list resets
        fetchPosts(1, null);
      }
    }, 500);
  };

  const handleSearchSubmit = () => {
    // Immediate search on submit
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    setPage(1);
    if (searchQuery && searchQuery.trim()) {
      router.setParams({ search: searchQuery.trim() });
    } else {
      router.setParams({ search: undefined });
      // Immediately fetch with null search to ensure list resets
      fetchPosts(1, null);
    }
  };

  const handleClear = () => {
    // Clear immediately without debounce
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    setSearchQuery('');
    setPage(1);
    router.setParams({ search: undefined });

    // Force fetch with null search to ensure list resets
    fetchPosts(1, null);
  };

  const handleRemoveFilter = (filterKey: string) => {
    if (filterKey === 'priceRange') {
      router.setParams({ minPrice: undefined, maxPrice: undefined });
    } else if (filterKey === 'location') {
      router.setParams({ locationLatitude: undefined, locationLongitude: undefined, locationName: undefined });
    } else if (filterKey === 'sortBy') {
      router.setParams({ sortBy: undefined });
    } else if (filterKey === 'category') {
      router.setParams({ categoryId: undefined, category: undefined, subcategoryId: undefined, subcategoryName: undefined });
    }
  };

  const getActiveFilters = () => {
    const active: { key: string; label: string }[] = [];

    if (params.minPrice || params.maxPrice) {
      const min = (params.minPrice as string) || '0';
      const max = (params.maxPrice as string) || '∞';
      active.push({ key: 'priceRange', label: `₹${min} - ₹${max}` });
    }

    if (params.locationLatitude && params.locationLongitude) {
      active.push({ key: 'location', label: (params.locationName as string) || 'Selected Location' });
    }

    if (params.categoryId) {
      // Show subcategory if selected, otherwise show category
      if (params.subcategoryId) {
        active.push({ key: 'category', label: `${params.category} > ${params.subcategoryName}` });
      } else {
        active.push({ key: 'category', label: (params.category as string) || 'Category' });
      }
    }

    if (params.sortBy && params.sortBy !== 'Most Recent') {
      active.push({ key: 'sortBy', label: params.sortBy as string });
    }

    return active;
  };

  const activeFilters = getActiveFilters();

  const handleItemPress = (itemSlug: string) => {
    router.push(`/(pages)/detail/${itemSlug}`);
  };

  const { toggleFavorite } = useFavoriteToggle();

  const handleFavorite = async (postId: string) => {
    const postIndex = filteredPosts.findIndex(post => post.id === postId);
    if (postIndex === -1) return;

    const post = filteredPosts[postIndex];
    const wasFavorite = post.isFavorite ?? false;

    // Optimistic update
    const updatedPosts = [...filteredPosts];
    updatedPosts[postIndex] = { ...post, isFavorite: !wasFavorite };
    setFilteredPosts(updatedPosts);

    const success = await toggleFavorite(postId, wasFavorite);
    if (!success) {
      // Revert
      setFilteredPosts(prev => {
        const reverted = [...prev];
        reverted[postIndex] = { ...reverted[postIndex], isFavorite: wasFavorite };
        return reverted;
      });
    }
  };

  return (
    <ThemedView style={[styles.container, isDesktop && styles.desktopContainer]}>
      <LocationBanner onPermissionGranted={() => fetchPosts(1)} />
      <ScrollView
        style={styles.content}
        contentContainerStyle={!isDesktop ? { paddingBottom: TabBar.paddingBottom } : undefined}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={() => fetchPosts(1)}
            colors={[Colors.light.primary]}
            tintColor={Colors.light.primary}
          />
        }
      >

        <View style={isDesktop ? styles.desktopHomeWrapper : null}>
          {isDesktop && (
            <SideBanners
              ads={platformAds.filter(ad => ad.position === PlatformAdPosition.LEFT)}
              position={PlatformAdPosition.LEFT}
            />
          )}

          <View style={isDesktop ? styles.desktopMainContent : null}>
            <View style={[styles.itemsSection, isDesktop && styles.desktopItemsSection]}>

              {isDesktop && (
                <View style={styles.sectionHeader}>
                  <View>
                    <ThemedText style={styles.sectionTitle}>Browse Posts</ThemedText>
                    <ThemedText style={styles.sectionSubtitle}>
                      {pagination?.total || 0} {pagination?.total === 1 ? 'item' : 'items'} found
                    </ThemedText>
                  </View>
                </View>
              )}

              {/* Search and Filter Section - Both Mobile and Desktop */}
              <View style={[styles.searchSection, isDesktop && styles.desktopSearchSection]}>
                {/* Desktop Inline Filters with Search */}
                {isDesktop ? (
                  <DesktopFilters
                    filters={desktopFilters}
                    onFiltersChange={handleDesktopFiltersChange}
                    onReset={handleDesktopFiltersReset}
                    searchQuery={searchQuery}
                    onSearchChange={(text) => {
                      setSearchQuery(text);
                      handleSearch(text);
                    }}
                    onSearchSubmit={handleSearchSubmit}
                    onSearchClear={handleClear}
                  />
                ) : (
                  <View style={styles.searchContainer}>
                    <SearchBar
                      ref={searchInputRef}
                      value={searchQuery}
                      onChangeText={(text) => {
                        setSearchQuery(text);
                        handleSearch(text);
                      }}
                      onSubmitEditing={() => {
                        handleSearchSubmit();
                      }}
                      onClear={() => {
                        handleClear();
                      }}
                      placeholder="Search items..."
                      showFilter={true}
                      autoFocus={params.focusSearch === 'true' && !isDesktop}
                      containerStyle={styles.searchBarContainer}
                    />
                  </View>
                )}

                {/* Active Filters - Show only on mobile */}
                {!isDesktop && activeFilters.length > 0 && (
                  <View style={styles.activeFiltersSection}>
                    <ScrollView 
                      horizontal 
                      showsHorizontalScrollIndicator={false}
                      style={styles.activeFiltersScroll}
                      contentContainerStyle={styles.activeFiltersScrollContent}
                    >
                      <Pressable
                        onPress={() => {
                          // Reset filter context state
                          resetFilterContext();
                          // Clear all filters from URL params
                          router.setParams({
                            minPrice: undefined,
                            maxPrice: undefined,
                            locationLatitude: undefined,
                            locationLongitude: undefined,
                            locationName: undefined,
                            categoryId: undefined,
                            category: undefined,
                            subcategoryId: undefined,
                            subcategoryName: undefined,
                            sortBy: undefined
                          });
                        }}
                        style={[styles.filterChip, styles.clearAllChip]}
                      >
                        <MaterialIcons name="filter-list-off" size={14} color={Colors.light.primary} />
                        <ThemedText style={styles.clearAllText}>Clear All</ThemedText>
                      </Pressable>

                      {activeFilters.map((filter) => (
                        <View key={filter.key} style={styles.filterChip}>
                          <ThemedText style={styles.filterChipText}>{filter.label}</ThemedText>
                          <Pressable
                            onPress={() => handleRemoveFilter(filter.key)}
                            style={styles.filterChipCloseButton}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          >
                            <MaterialIcons name="close" size={14} color={Colors.light.textSecondary} />
                          </Pressable>
                        </View>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </View>

              {isLoading ? (
                <View style={styles.loadingState}>
                  <ActivityIndicator size="large" color={Colors.light.primary} />
                  <ThemedText style={styles.loadingText}>Loading items...</ThemedText>
                </View>
              ) : filteredPosts.length === 0 ? (
                <View style={styles.emptyState}>
                  <ThemedText style={styles.emptyStateTitle}>No items found</ThemedText>
                  <ThemedText style={styles.emptyStateSubtitle}>
                    Try adjusting your filters or search terms
                  </ThemedText>
                </View>
              ) : (
                <>
                  {!isDesktop && <MobilePlatformBanners ads={platformAds} position="top" compact style={{ marginTop: 8, marginBottom: 16 }} />}
                  <View style={[styles.itemsGrid, isDesktop && styles.desktopItemsGrid]}>
                    {filteredPosts.map((post) => (
                      <AdCard
                        key={post.id}
                        id={String(post.id)}
                        slug={post.slug}
                        title={post.title}
                        location={post.locationFormatted || post.locationCity || 'Location'}
                        price={!shouldHidePrice(post.price) ? formatPrice(post.price) : ''}
                        discountedPrice={post.discountedPrice && !shouldHidePrice(post.discountedPrice) ? formatPrice(post.discountedPrice) : undefined}
                        image={post.images?.[0]}
                        publisherName={post.user ? `${post.user.firstName}${post.user.lastName ? ' ' + post.user.lastName : ''}` : undefined}
                        category={post.category?.name}
                        subcategory={post.subcategory?.name}
                        categoryPlaceholder={post.category?.adPlaceholder}
                        status={post.status}

                        onPress={handleItemPress}
                        onFavorite={handleFavorite}
                        isFavorite={post.isFavorite || false}
                        containerStyle={isDesktop ? styles.desktopAdCard : { width: (screenWidth - 40) / 2 - 8, marginBottom: 16 }}
                      />
                    ))}
                  </View>

                  {!isDesktop && <MobilePlatformBanners ads={platformAds} position="bottom" style={{ marginBottom: 24 }} />}

                  {pagination && (
                    <PaginationControls
                      pagination={pagination}
                      onPageChange={(newPage) => fetchPosts(newPage)}
                      loading={isLoading}
                    />
                  )}
                </>
              )}
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

    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingTop: 80,
  },
  desktopContainer: {
    paddingTop: 0,
  },
  content: {
    flex: 1,
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
  inlinePlatformRail: {
    width: '100%',
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  inlinePlatformRailDesktop: {
    maxWidth: 1400,
    alignSelf: 'center',
    paddingHorizontal: 24,
    borderBottomWidth: 0,
  },
  inlinePlatformRailBottom: {
    width: '100%',
    marginTop: 16,
    marginBottom: 8,
  },
  inlinePlatformRailScroll: {
    flexGrow: 0,
    ...(Platform.OS === 'web' ? { width: '100%' as const, maxWidth: '100%' as const } : {}),
  },
  inlinePlatformRailScrollContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  inlinePlatformAdPressable: {
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#EEEEEE',
    backgroundColor: '#FAFAFA',
  },
  inlinePlatformAdImage: {
    width: 168,
    height: 56,
  },
  searchSection: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 0,
    paddingVertical: 8,
    zIndex: 100,
  },
  desktopSearchSection: {
    paddingHorizontal: 0,
    paddingVertical: 20,
    maxWidth: 1000,
    width: '100%',
    alignSelf: 'center',
    zIndex: 100,
  },
  searchContainer: {
    width: '100%',
  },
  searchBarContainer: {
    marginBottom: 0,
    paddingHorizontal: 0,
  },

  // Enhanced Active Filters Section
  activeFiltersSection: {
    marginTop: 12,
  },
  desktopActiveFiltersSection: {
    paddingHorizontal: 0,
  },
  clearAllChip: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FEE2E2',
    paddingRight: 12,
  },
  clearAllText: {
    fontSize: 12,
    color: Colors.light.primary,
    fontWeight: '700',
  },

  mobileSearchContainer: {
    backgroundColor: '#FFFFFF',
    paddingTop: 4,
    paddingBottom: 0,
  },

  // Items Section
  itemsSection: {
    paddingHorizontal: 16,
  },
  desktopItemsSection: {
    paddingTop: 24,
    paddingHorizontal: 40,
    maxWidth: 1000,
    width: '100%',
    alignSelf: 'center',
  },
  sectionHeader: {
    marginBottom: 0,
  },
  sectionTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#000000',
  },
  sectionSubtitle: {
    fontSize: 16,
    color: '#666666',
  },

  // Active Filters
  activeFiltersScroll: {
    marginHorizontal: -16, // Bleed to edges
    paddingHorizontal: 16,
    paddingBottom: 4,
  },
  activeFiltersScrollContent: {
    gap: 8,
    paddingRight: 32,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    gap: 4,
    borderWidth: 1,
    borderColor: '#EEEEEE',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
      },
      android: {
        elevation: 1,
      },
    }),
  },
  filterChipText: {
    fontSize: 12,
    color: '#444444',
    fontWeight: '600',
  },
  filterChipCloseButton: {
    padding: 4,
    marginLeft: 4,
  },

  // Items Grid
  itemsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  desktopItemsGrid: {
    gap: 24,
    justifyContent: 'flex-start',
  },
  desktopAdCard: {
    width: '23%',
    marginBottom: 16,
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 40,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyStateSubtitle: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    lineHeight: 22,
  },

  // Loading State
  loadingState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
    paddingHorizontal: 40,
  },
  loadingText: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
  },
});
