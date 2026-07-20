import { StyleSheet, View, TouchableOpacity, FlatList, ActivityIndicator, ScrollView, RefreshControl } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useState, useEffect } from 'react';
import { router, useLocalSearchParams } from 'expo-router';

import { Footer } from '@/components/footer';
import { MobilePlatformBanners } from '@/components/mobile-platform-banners';
import { AuthProtection } from '@/components/auth-protection';
import { SideBanners } from '@/components/home/side-banners';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { SearchBar } from '@/components/search-bar';
import { AdsContent } from '@/components/my-ads/ads-content';
import { BookingContent } from '@/components/my-ads/booking-content';
import { MyAdsFilterBottomSheet, type MyAdsFilterOptions } from '@/components/ui/my-ads-filter-bottom-sheet';
import { useAlert } from '@/components/ui/custom-alert';
import { Colors, Shadows, TabBar } from '@/constants/theme';
import { adsService, bookingsService, platformAdsService } from '@/services';
import type { Ad, Booking } from '@/types/api.types';
import type { PlatformAd } from '@/types/api.types';
import { PlatformAdPosition } from '@/types/api.types';
import { appEvents } from '@/utils/event-emitter';
import { useResponsive } from '@/hooks/use-responsive';
import { HEADER_HEIGHT } from '@/constants/layout';

export default function MyAdsScreen() {
  const params = useLocalSearchParams();
  const { showAlert } = useAlert();
  const [activeTab, setActiveTab] = useState('ads');
  const [searchQuery, setSearchQuery] = useState('');
  const { isDesktop } = useResponsive();
  const [showFilter, setShowFilter] = useState(false);

  const [myAds, setMyAds] = useState<Ad[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoadingAds, setIsLoadingAds] = useState(false);
  const [isLoadingBookings, setIsLoadingBookings] = useState(false);
  const [platformAds, setPlatformAds] = useState<PlatformAd[]>([]);
  const [isLoadingPlatformAds, setIsLoadingPlatformAds] = useState(true);
  const [deleteToastShown, setDeleteToastShown] = useState(false);
  const [adsPage, setAdsPage] = useState(1);
  const [hasMoreAds, setHasMoreAds] = useState(true);
  const [loadingMoreAds, setLoadingMoreAds] = useState(false);
  const [searchTimeout, setSearchTimeout] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [currentFilters, setCurrentFilters] = useState<MyAdsFilterOptions>({
    adStatus: 'all',
    bookingStatus: 'all',
    category: 'All Categories',
    dateRange: 'all',
    sortBy: 'newest',
  });

  const handleRefresh = async () => {
    if (activeTab === 'ads') {
      await fetchMyAds(1, false);
    } else {
      await fetchBookings();
    }
  };


  useEffect(() => {
    if (activeTab === 'ads') {
      fetchMyAds(1, false);
    } else if (activeTab === 'booking') {
      fetchBookings();
    }
    fetchPlatformAds();
  }, [activeTab]);

  useEffect(() => {
    const unsubscribe = appEvents.on('ad:deleted', () => {
      showAlert({
        title: 'Deleted',
        message: 'Ad deleted successfully',
        type: 'success',
      });
    });

    return unsubscribe;
  }, [showAlert]);

  // Fallback: if we navigated with deleted=1, show success once on this screen.
  useEffect(() => {
    if (params.deleted === '1' && !deleteToastShown) {
      setDeleteToastShown(true);
      setTimeout(() => {
        showAlert({
          title: 'Deleted',
          message: 'Ad deleted successfully',
          type: 'success',
        });
      }, 120);
    }
  }, [params.deleted, deleteToastShown, showAlert]);

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
  
  const fetchMyAds = async (pageNum: number = 1, append: boolean = false, searchTerm?: string, filters?: MyAdsFilterOptions) => {
    try {
      if (pageNum === 1) {
        setIsLoadingAds(true);
      } else {
        setLoadingMoreAds(true);
      }

      const searchParam = searchTerm !== undefined ? searchTerm : searchQuery;
      const activeFilters = filters || currentFilters;

      const params: any = {
        page: pageNum,
        limit: 20
      };

      if (searchParam && searchParam.trim()) {
        params.search = searchParam.trim();
      }

      // Apply My Ads specific filters - Map UI status to API status
      if (activeFilters.adStatus && activeFilters.adStatus !== 'all') {
        const statusMapping: Record<string, string> = {
          'active': 'ACTIVE',
          'review': 'REVIEW',
          'expired': 'EXPIRED',
          'rejected': 'REJECTED',
        };
        params.status = statusMapping[activeFilters.adStatus];
      }

      if (activeFilters.category && activeFilters.category !== 'All Categories') {
        params.categoryId = activeFilters.categoryId;
      }

      // Map dateRange to API parameters
      if (activeFilters.dateRange && activeFilters.dateRange !== 'all') {
        const now = new Date();
        switch (activeFilters.dateRange) {
          case 'today': {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            params.startDate = today.toISOString();
            break;
          }
          case 'week': {
            const weekAgo = new Date();
            weekAgo.setDate(weekAgo.getDate() - 7);
            params.startDate = weekAgo.toISOString();
            break;
          }
          case 'month': {
            const monthAgo = new Date();
            monthAgo.setMonth(monthAgo.getMonth() - 1);
            params.startDate = monthAgo.toISOString();
            break;
          }
          case 'year': {
            const yearAgo = new Date();
            yearAgo.setFullYear(yearAgo.getFullYear() - 1);
            params.startDate = yearAgo.toISOString();
            break;
          }
        }
      }

      // Map sortBy to API parameters
      switch (activeFilters.sortBy) {
        case 'oldest':
          params.sortBy = 'createdAt';
          params.sortOrder = 'asc';
          break;
        case 'price-high':
          params.sortBy = 'price';
          params.sortOrder = 'desc';
          break;
        case 'price-low':
          params.sortBy = 'price';
          params.sortOrder = 'asc';
          break;
        case 'name':
          params.sortBy = 'title';
          params.sortOrder = 'asc';
          break;
        case 'newest':
        default:
          params.sortBy = 'createdAt';
          params.sortOrder = 'desc';
          break;
      }


      const response = await adsService.getMyAds(params);
      if (response.success && response.data) {
        const adsData = Array.isArray(response.data) ? response.data : response.data;
        const newData = adsData || [];
        if (append) {
          setMyAds(prev => [...prev, ...newData]);
        } else {
          setMyAds(newData);
        }
        setHasMoreAds(response.pagination?.hasNextPage || newData.length === 20);
        setAdsPage(pageNum);
      }
    } catch (error) {
    } finally {
      setIsLoadingAds(false);
      setLoadingMoreAds(false);
    }
  };
  
  const fetchBookings = async (searchTerm?: string, filters?: MyAdsFilterOptions) => {
    try {
      setIsLoadingBookings(true);
      const activeFilters = filters || currentFilters;
      const searchParam = searchTerm !== undefined ? searchTerm : searchQuery;

      const params: any = {
        page: 1,
        limit: 20
      };

      // Add search parameter
      if (searchParam && searchParam.trim()) {
        params.search = searchParam.trim();
      }

      // Apply My Ads specific filters - Map UI status to API status
      if (activeFilters.bookingStatus && activeFilters.bookingStatus !== 'all') {
        const statusMapping: Record<string, string> = {
          'pending': 'SUBMITTED',
          'confirmed': 'CONFIRMED',
          'completed': 'COMPLETED',
          'cancelled': 'CANCELLED',
        };
        params.status = statusMapping[activeFilters.bookingStatus];
      }


      const response = await bookingsService.getIncomingBookings(params);
      if (response.success && response.data) {
        setBookings(response.data);
      }
    } catch (error) {
    } finally {
      setIsLoadingBookings(false);
    }
  };

  const handleLoadMoreAds = () => {
    if (!loadingMoreAds && hasMoreAds && activeTab === 'ads') {
      fetchMyAds(adsPage + 1, true);
    }
  };

  useEffect(() => {
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }
  }, []);

  // Handle tab parameter from URL
  useEffect(() => {
    const tabParam = params.tab as string;
    if (tabParam && ['ads', 'booking'].includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, [params.tab]);

  const tabs = [
    { id: 'ads', label: 'Ads' },
    { id: 'booking', label: 'Bookings' },
  ];

  const handleAdPress = (adSlug: string) => {
    router.push(`/(pages)/ad-stats/${adSlug}`);
  };

  const handleBookingPress = (bookingId: number) => {
    router.push(`/ad-booking-detail?id=${bookingId}`);
  };

  const handleFavorite = (adId: number) => {
  };

  const handleSearch = (text: string) => {
    setSearchQuery(text);

    // Clear existing timeout
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }

    // Reset pagination and clear existing data
    setAdsPage(1);
    setHasMoreAds(true);

    // Set new timeout for debounced search
    const timeout = setTimeout(() => {
      if (activeTab === 'ads') {
        fetchMyAds(1, false, text, currentFilters);
      } else if (activeTab === 'booking') {
        fetchBookings(text, currentFilters);
      }
    }, 500);

    setSearchTimeout(timeout);
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }
    // Reset pagination state
    setAdsPage(1);
    setHasMoreAds(true);

    if (activeTab === 'ads') {
      fetchMyAds(1, false, '', currentFilters);
    } else if (activeTab === 'booking') {
      fetchBookings('', currentFilters);
    }
  };

  const handleApplyFilters = (filters: MyAdsFilterOptions, searchQuery?: string) => {
    setCurrentFilters(filters);
    setAdsPage(1);
    setHasMoreAds(true);

    if (activeTab === 'ads') {
      fetchMyAds(1, false, searchQuery, filters);
    } else if (activeTab === 'booking') {
      fetchBookings(searchQuery, filters);
    }
  };

  const handleResetFilters = () => {
    const defaultFilters: MyAdsFilterOptions = {
      adStatus: 'all',
      bookingStatus: 'all',
      category: 'All Categories',
      dateRange: 'all',
      sortBy: 'newest',
    };
    setCurrentFilters(defaultFilters);
    setAdsPage(1);
    setHasMoreAds(true);

    if (activeTab === 'ads') {
      fetchMyAds(1, false, '', defaultFilters);
    } else if (activeTab === 'booking') {
      fetchBookings('', defaultFilters);
    }
  };

  // Get search placeholder based on active tab
  const getSearchPlaceholder = () => {
    switch (activeTab) {
      case 'ads':
        return 'Search your ads...';
      case 'booking':
        return 'Search bookings...';
      default:
        return 'Search...';
    }
  };

  const renderContent = () => {
    if (activeTab === 'ads') {
      return (
        <AdsContent
          searchQuery={searchQuery}
          ads={myAds}
          onAdPress={handleAdPress}
          onFavorite={handleFavorite}
          onLoadMore={handleLoadMoreAds}
          hasMore={hasMoreAds}
          loadingMore={loadingMoreAds}
          isLoading={isLoadingAds}
        />
      );
    }
    return (
      <BookingContent
        searchQuery={searchQuery}
        bookings={bookings}
        onBookingPress={handleBookingPress}
        isLoading={isLoadingBookings}
      />
    );
  };

  return (
    <AuthProtection>
      <ThemedView style={styles.container}>
          {isDesktop ? (
            <ScrollView 
              style={styles.desktopScroll} 
              contentContainerStyle={styles.desktopScrollContent} 
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl
                  refreshing={activeTab === 'ads' ? isLoadingAds : isLoadingBookings}
                  onRefresh={handleRefresh}
                  colors={[Colors.light.primary]}
                  tintColor={Colors.light.primary}
                />
              }
            >
              <View style={styles.desktopHeader}>
                <ThemedText style={styles.desktopTitle}>My Ads</ThemedText>
                <ThemedText style={styles.desktopSubtitle}>Manage your listings and bookings</ThemedText>
              </View>

              <View style={styles.desktopBannersRow}>
                <SideBanners
                  ads={platformAds.filter(ad => ad.position === PlatformAdPosition.LEFT)}
                  position={PlatformAdPosition.LEFT}
                />
                <View style={styles.desktopContentArea}>
                  <View style={[styles.tabsContainer, styles.desktopTabsContainer]}>
                    {tabs.map((tab) => (
                      <TouchableOpacity
                        key={tab.id}
                        style={[
                          styles.tab,
                          activeTab === tab.id && styles.activeTab,
                          styles.desktopTab
                        ]}
                        onPress={() => setActiveTab(tab.id)}
                      >
                        <ThemedText style={[
                          styles.tabText,
                          activeTab === tab.id && styles.activeTabText,
                          styles.desktopTabText
                        ]}>
                          {tab.label}
                        </ThemedText>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <SearchBar
                    value={searchQuery}
                    onChangeText={handleSearch}
                    onClear={handleClearSearch}
                    onFilter={() => setShowFilter(true)}
                    placeholder={getSearchPlaceholder()}
                    containerStyle={[styles.searchContainer, styles.desktopSearchContainer]}
                  />

                  <View style={styles.desktopListContent}>
                    {renderContent()}
                  </View>
                </View>
                <SideBanners
                  ads={platformAds.filter(ad => ad.position === PlatformAdPosition.RIGHT)}
                  position={PlatformAdPosition.RIGHT}
                />
              </View>

              <Footer />
            </ScrollView>
          ) : (
            <FlatList
              data={[{ key: 'content' }]}
              keyExtractor={(item) => item.key}
              contentContainerStyle={[styles.listContent, !isDesktop && { paddingBottom: TabBar.paddingBottom }]}
              refreshControl={
                <RefreshControl
                  refreshing={activeTab === 'ads' ? isLoadingAds : isLoadingBookings}
                  onRefresh={handleRefresh}
                  colors={[Colors.light.primary]}
                  tintColor={Colors.light.primary}
                />
              }
              ListHeaderComponent={
                <>
                  <View style={styles.tabsContainer}>
                    {tabs.map((tab) => (
                      <TouchableOpacity
                        key={tab.id}
                        style={[
                          styles.tab,
                          activeTab === tab.id && styles.activeTab
                        ]}
                        onPress={() => setActiveTab(tab.id)}
                      >
                        <ThemedText style={[
                          styles.tabText,
                          activeTab === tab.id && styles.activeTabText
                        ]}>
                          {tab.label}
                        </ThemedText>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <SearchBar
                    value={searchQuery}
                    onChangeText={handleSearch}
                    onClear={handleClearSearch}
                    onFilter={() => setShowFilter(true)}
                    placeholder={getSearchPlaceholder()}
                    containerStyle={styles.searchContainer}
                  />

                  {!isDesktop && <MobilePlatformBanners ads={platformAds} position="top" style={{ marginTop: 8, marginBottom: 16, paddingHorizontal: 16 }} />}
                </>
              }
              renderItem={() => (
                <View style={styles.contentWrapper}>
                  {renderContent()}
                </View>
              )}
              ListFooterComponent={
                <>
                  {!isDesktop && <MobilePlatformBanners ads={platformAds} position="bottom" style={{ marginBottom: 24, paddingHorizontal: 16 }} />}
                  <Footer />
                </>
              }
              showsVerticalScrollIndicator={false}
            />
          )}
        </ThemedView>

      {/* Render My Ads filter modal */}
      <MyAdsFilterBottomSheet
        visible={showFilter}
        onClose={() => setShowFilter(false)}
        onApply={handleApplyFilters}
        onReset={handleResetFilters}
        filters={currentFilters}
        activeTab={activeTab as 'ads' | 'booking'}
      />
    </AuthProtection>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    // paddingBottom: Platform.OS === 'web' ? 0 : 90,
  },
  listContent: {
    flexGrow: 1,
  },
  // Desktop Scroll
  desktopScroll: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  desktopScrollContent: {
    flexGrow: 1,
  },
  // Desktop Banners Row
  desktopBannersRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-start',
    width: '100%',
    flex: 1,
  },
  desktopContentArea: {
    flex: 1,
    maxWidth: 1000,
    width: '100%',
    paddingBottom: 40,
  },
  desktopListContent: {
    flex: 1,
    paddingHorizontal: 40,
    paddingBottom: 40,
  },
  desktopContentWrapper: {
    flex: 1,
    maxWidth: 1000,
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: 40,
    paddingBottom: 40,
  },
  // Desktop Header
  desktopHeader: {
    paddingTop: 40,
    paddingBottom: 20,
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    width: '100%',
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
    textAlign: 'center',
  },
  // Tabs
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#F5F5F5',
    marginHorizontal: 16,
    marginTop: HEADER_HEIGHT, // Space for fixed header
    borderRadius: 20,
    padding: 3,
  },
  desktopTabsContainer: {
    marginHorizontal: 0,
    marginTop: 40,
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
    backgroundColor: '#F0F0F0',
    borderRadius: 20,
    padding: 3,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 16,
    alignItems: 'center',
  },
  desktopTab: {
    paddingVertical: 10,
    borderRadius: 16,
  },
  activeTab: {
    backgroundColor: '#FFFFFF',
    ...Shadows.soft,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.light.textSecondary,
  },
  desktopTabText: {
    fontSize: 14,
    fontWeight: '600',
  },
  activeTabText: {
    color: Colors.light.primary,
    fontWeight: '600',
  },
  // Search
  searchContainer: {
    marginTop: 16,
    marginBottom: 12,
  },
  desktopSearchContainer: {
    marginTop: 32,
    maxWidth: 800,
    width: '100%',
    alignSelf: 'center',
  },
  contentWrapper: {
    flex: 1,
  },
  // Create Ad Button
  createAdButton: {
    position: 'absolute',
    bottom: 90, // Increased to account for tab bar height
    right: 16,
    backgroundColor: Colors.light.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    ...Shadows.primary,
  },
  desktopCreateAdButton: {
    position: 'fixed',
    bottom: 40,
    right: 40,
    backgroundColor: Colors.light.primary,
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 30,
    ...Shadows.primary,
    zIndex: 1000,
  },
  createAdButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});
