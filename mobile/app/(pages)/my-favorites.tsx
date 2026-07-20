import React, { useState, useEffect, useCallback, useRef } from 'react';
import { StyleSheet, View, ScrollView, ActivityIndicator, TextInput, RefreshControl, Platform } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { AuthProtection } from '@/components/auth-protection';
import { Footer } from '@/components/footer';
import { DesktopProfileLayout } from '@/components/desktop-profile-layout';
import { AdCard } from '@/components/ad-card';
import { Colors } from '@/constants/theme';
import { userService } from '@/services';
import { formatPrice, shouldHidePrice } from '@/utils/price-formatter';
import { useResponsive } from '@/hooks/use-responsive';
import { useFavoriteToggle } from '@/hooks/use-favorite-toggle';
import { HEADER_HEIGHT } from '@/constants/layout';
import type { WishlistItem } from '@/types/api.types';

export default function MyFavoritesScreen() {
  const router = useRouter();
  const { toggleFavorite } = useFavoriteToggle();
  const { isDesktop } = useResponsive();
  const [favorites, setFavorites] = useState<WishlistItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Debounce search query
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 500);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [searchQuery]);

  const fetchFavorites = useCallback(async (pageNum: number = 1, append: boolean = false, query: string = '', isRefresh: boolean = false) => {
    try {
      if (isRefresh) {
        setIsRefreshing(true);
      } else if (pageNum === 1) {
        setIsLoading(true);
      } else {
        setLoadingMore(true);
      }
      const params: { page: number; limit: number; search?: string } = { page: pageNum, limit: 20 };
      if (query && query.trim()) {
        params.search = query.trim();
      }
      const favResp = await userService.getWishlist(params);
      if (favResp.success && favResp.data) {
        const newData = favResp.data || [];

        if (append) {
          setFavorites(prev => [...prev, ...newData]);
        } else {
          setFavorites(newData);
        }
        setHasMore(favResp.pagination?.hasNextPage || false);
        setPage(pageNum);
      }
    } catch (e) {
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
      setLoadingMore(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setPage(1);
      setHasMore(true);
      fetchFavorites(1, false, debouncedSearch);
    }, [fetchFavorites, debouncedSearch])
  );

  const handleSearchChange = (text: string) => {
    setSearchQuery(text);
  };

  const handleSearchSubmit = () => {
    setDebouncedSearch(searchQuery);
  };

  return (
    <AuthProtection>
      <DesktopProfileLayout>
        <ThemedView style={[styles.container, { paddingTop: isDesktop ? 0 : HEADER_HEIGHT }]}>
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={() => fetchFavorites(1, false, debouncedSearch, true)}
                colors={[Colors.light.primary]}
                tintColor={Colors.light.primary}
              />
            }
            showsVerticalScrollIndicator={false}
          >
            {/* Header */}
            <View style={styles.header}>
              <ThemedText style={styles.title}>My Favorites</ThemedText>
              <ThemedText style={styles.subtitle}>
                Ads you've saved for later
              </ThemedText>
            </View>

            {/* Search */}
            <View style={styles.searchContainer}>
              <MaterialIcons name="search" size={20} color={Colors.light.textSecondary} style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search favorites..."
                value={searchQuery}
                onChangeText={handleSearchChange}
                onSubmitEditing={handleSearchSubmit}
                returnKeyType="search"
                placeholderTextColor={Colors.light.textSecondary}
              />
            </View>

            {/* Content */}
            {isLoading ? (
              <View style={styles.loadingState}>
                <ThemedText style={styles.loadingText}>Loading favorites...</ThemedText>
              </View>
            ) : favorites.length === 0 ? (
              <View style={styles.emptyState}>
                {searchQuery === '' ? (
                  <>
                    <MaterialIcons name="favorite" size={64} color={Colors.light.textSecondary} />
                    <ThemedText style={styles.emptyText}>No favorites yet</ThemedText>
                    <ThemedText style={styles.emptySubtext}>
                      Save ads you like by tapping the heart icon
                    </ThemedText>
                  </>
                ) : (
                  <>
                    <MaterialIcons name="search-off" size={64} color={Colors.light.textSecondary} />
                    <ThemedText style={styles.emptyText}>No favorites found</ThemedText>
                    <ThemedText style={styles.emptySubtext}>
                      Try a different search term
                    </ThemedText>
                  </>
                )}
              </View>
            ) : (
              <View style={styles.grid}>
                {favorites.map((favorite) => (
                  <AdCard
                    key={favorite.id}
                    id={favorite.ad?.id || favorite.id}
                    slug={favorite.ad?.slug || favorite.ad?.id || favorite.id}
                    title={favorite.ad?.title || 'Untitled Ad'}
                    description={""}
                    location={favorite.ad?.locationFormatted || favorite.ad?.locationCity || 'Location'}
                    price={favorite.ad?.price && !shouldHidePrice(favorite.ad.price) ? formatPrice(favorite.ad.price) : ''}
                    image={favorite.ad?.images && favorite.ad.images.length > 0 ? favorite.ad.images[0] : ''}
                    category={favorite.ad?.category?.name}
                    subcategory={favorite.ad?.subcategory?.name}
                    categoryPlaceholder={favorite.ad?.category?.adPlaceholder}
                    status={favorite.ad?.status}
                    onPress={(slug) => {
                      if (slug) {
                        router.push(`/(pages)/detail/${slug}`);
                      }
                    }}
                    isFavorite={true}
                    onFavorite={async (id) => {
                      const favItem = favorites.find(f => f.ad?.id === id);
                      if (!favItem) return;

                      // Optimistic removal
                      setFavorites(prev => prev.filter(fav => fav.id !== favItem.id));

                      const success = await toggleFavorite(id, true);
                      if (!success) {
                        // Revert - refetch the page
                        fetchFavorites(1, false, debouncedSearch);
                      }
                    }}
                    containerStyle={isDesktop ? { width: '32%', marginBottom: 16, marginRight: '1%' } : { width: '48.5%', marginBottom: 16 }}
                  />
                ))}
              </View>
            )}

            {loadingMore && (
              <ActivityIndicator size="large" color={Colors.light.primary} style={{ marginVertical: 20 }} />
            )}

            {!isDesktop && <Footer />}
          </ScrollView>
        </ThemedView>
      </DesktopProfileLayout>
    </AuthProtection>
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
  scrollContent: {
    paddingBottom: 20,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 0,
    paddingBottom: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.light.textSecondary,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    paddingHorizontal: 12,
    marginHorizontal: 16,
    marginBottom: 20,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: Colors.light.text,
    borderWidth: 0,
    ...(Platform.OS === 'web' ? ({
      outlineWidth: 0,
      outlineColor: 'transparent',
      outlineStyle: 'none',
    } as any) : {}),
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    marginTop: 4,
    textAlign: 'center',
  },
  loadingState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
    paddingHorizontal: 40,
  },
  loadingText: {
    fontSize: 16,
    color: Colors.light.textSecondary,
    textAlign: 'center',
    marginTop: 12,
  },
});
