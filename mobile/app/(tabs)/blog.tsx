import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState, useCallback } from 'react';
import { Platform, FlatList, StyleSheet, View, ActivityIndicator, TouchableOpacity, ScrollView, RefreshControl } from 'react-native';

import { Footer } from '@/components/footer';
import { MobilePlatformBanners } from '@/components/mobile-platform-banners';
import { BlogCard } from '@/components/blog-card';
import { SearchBar } from '@/components/search-bar';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { useResponsive } from '@/hooks/use-responsive';
import { blogService, Blog as BlogPost, BlogCategory } from '@/services/blog.service';
import { platformAdsService } from '@/services';
import { Colors, TabBar } from '@/constants/theme';
import { HEADER_HEIGHT } from '@/constants/layout';
import { useDebounce } from '@/utils/debounce';
import { PaginationControls } from '@/components/ui/pagination';
import { PaginationMeta } from '@/services/pagination.service';
import { SideBanners } from '@/components/home/side-banners';
import { PlatformAd, PlatformAdPosition } from '@/types/api.types';

export default function BlogScreen() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [blogPosts, setBlogPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [categories, setCategories] = useState<BlogCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<BlogCategory | null>(null);
  const { isDesktop, screenWidth } = useResponsive();
  const [platformAds, setPlatformAds] = useState<PlatformAd[]>([]);
  const [isLoadingPlatformAds, setIsLoadingPlatformAds] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Debounced search query
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  // Fetch blog categories
  const fetchCategories = useCallback(async () => {
    try {
      const response = await blogService.getBlogCategories();
      if (response.success) {
        setCategories(response.data || []);
      }
    } catch (err) {
    }
  }, []);

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

  // Initial fetch blog categories
  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const fetchBlogPosts = useCallback(async (pageNum: number = 1, query?: string, categoryId?: string) => {
    try {
      setLoading(pageNum === 1);
      setLoadingMore(pageNum > 1);
      setError(null);
      const response = await blogService.getBlogs(pageNum, 20, query, categoryId);
      if (response.success) {
        const newData = response.data || [];
        const apiPagination = response.pagination;

        // Convert API pagination to our standard format
        const standardPagination = {
          page: apiPagination.page,
          limit: apiPagination.limit,
          total: apiPagination.total,
          totalPages: apiPagination.pages,
          hasNextPage: apiPagination.page < apiPagination.pages,
          hasPreviousPage: apiPagination.page > 1,
        };

        setBlogPosts(newData);
        setPagination(standardPagination);
      } else {
        setBlogPosts([]);
        setPagination(null);
      }
    } catch (err: any) {
      setError('Failed to load blog posts. Please try again later.');
      setBlogPosts([]);
      setPagination(null);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        fetchCategories(),
        fetchBlogPosts(1, debouncedSearchQuery, selectedCategory?.id)
      ]);
    } catch (error) {
    } finally {
      setRefreshing(false);
    }
  }, [fetchCategories, fetchBlogPosts, debouncedSearchQuery, selectedCategory]);

  useEffect(() => {
    fetchBlogPosts(1, debouncedSearchQuery, selectedCategory?.id);
  }, [debouncedSearchQuery, selectedCategory]);

  const handlePageChange = (newPage: number) => {
    fetchBlogPosts(newPage, debouncedSearchQuery, selectedCategory?.id);
  };

  const handleSearch = (query: string) => {
    // Update the search query immediately for better UX
    // The debounce hook will handle the delayed execution
    setSearchQuery(query);
  };

  const handleClear = () => {
    // Update the search query immediately
    setSearchQuery('');
  };

  const handleCategorySelect = (category: BlogCategory | null) => {
    setSelectedCategory(category);
  };

  const handleBlogPress = (slug: string) => {
    router.push({ pathname: '/blog/[slug]', params: { slug } });
  };

  return (
    <ThemedView style={styles.container}>
        <ScrollView
          style={styles.container}
          contentContainerStyle={!isDesktop ? { paddingBottom: TabBar.paddingBottom } : undefined}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[Colors.light.primary]}
              tintColor={Colors.light.primary}
            />
          }
        >
          {isDesktop && (
            <View style={styles.desktopHeader}>
              <ThemedText style={styles.desktopTitle}>Blog Posts</ThemedText>
              <ThemedText style={styles.desktopSubtitle}>Stay updated with the latest announcements and trends</ThemedText>
            </View>
          )}

          <View style={isDesktop ? styles.desktopHomeWrapper : null}>
            {isDesktop && (
              <SideBanners 
                ads={platformAds.filter(ad => ad.position === PlatformAdPosition.LEFT)} 
                position={PlatformAdPosition.LEFT} 
              />
            )}

            <View style={isDesktop ? styles.desktopMainContent : null}>
              <View style={isDesktop ? styles.desktopContentContainer : {}}>
                <SearchBar
                  value={searchQuery}
                  onChangeText={handleSearch}
                  onClear={handleClear}
                  placeholder="Search blog posts..."
                  showFilter={false}
                  containerStyle={[styles.searchContainer, isDesktop && styles.desktopSearchContainer]}
                />
                {categories.length > 0 && (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={[
                      styles.categoriesContainer,
                      isDesktop && styles.desktopCategoriesContainer
                    ]}
                  >
                    <TouchableOpacity
                      style={[
                        styles.categoryChip,
                        !selectedCategory && styles.categoryChipActive
                      ]}
                      onPress={() => handleCategorySelect(null)}
                    >
                      <ThemedText
                        style={[
                          styles.categoryChipText,
                          !selectedCategory && styles.categoryChipTextActive
                        ]}
                      >
                        All
                      </ThemedText>
                    </TouchableOpacity>
                    {categories.map((category) => (
                      <TouchableOpacity
                        key={category.id}
                        style={[
                          styles.categoryChip,
                          selectedCategory?.id === category.id && styles.categoryChipActive
                        ]}
                        onPress={() => handleCategorySelect(category)}
                      >
                        <ThemedText
                          style={[
                            styles.categoryChipText,
                            selectedCategory?.id === category.id && styles.categoryChipTextActive
                          ]}
                        >
                          {category.name}
                        </ThemedText>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}

                {!isDesktop && <MobilePlatformBanners ads={platformAds} position="top" style={{ marginBottom: 16, paddingHorizontal: 16 }} />}

                {loading && !refreshing ? (
                  <View style={styles.emptyState}>
                    <ActivityIndicator size="large" color={Colors.light.primary} />
                    <ThemedText style={styles.emptyStateText}>Loading blog posts...</ThemedText>
                  </View>
                ) : error ? (
                  <View style={styles.emptyState}>
                    <ThemedText style={[styles.emptyStateText, { color: 'red' }]}>{error}</ThemedText>
                  </View>
                ) : blogPosts.length === 0 ? (
                  <View style={styles.emptyState}>
                    <MaterialIcons name="rss-feed" size={64} color={Colors.light.textSecondary} />
                    <ThemedText style={styles.emptyStateTitle}>No blog posts found</ThemedText>
                    <ThemedText style={styles.emptyStateSubtitle}>Try adjusting your search or check back later</ThemedText>
                  </View>
                ) : (
                  <View style={styles.blogGrid}>
                    {blogPosts.map((item) => (
                      <View key={item.id.toString()} style={isDesktop ? styles.desktopBlogItem : styles.blogItemContainer}>
                        <BlogCard
                          id={item.id}
                          slug={item.slug}
                          title={item.title}
                          description={item.excerpt || item.content.substring(0, 150) + '...'}
                          category={item.category?.name || 'General'}
                          publishedAt={item.publishedAt}
                          image={item.imageUrl}
                          onPress={handleBlogPress}
                          containerStyle={isDesktop ? styles.desktopBlogCard : undefined}
                          imageStyle={isDesktop ? styles.desktopBlogImage : undefined}
                          showDescription={isDesktop}
                          isMobile={!isDesktop}
                        />
                      </View>
                    ))}
                  </View>
                )}

                {loadingMore && (
                  <ActivityIndicator size="large" color={Colors.light.primary} style={{ marginVertical: 20 }} />
                )}

                {!isDesktop && <MobilePlatformBanners ads={platformAds} position="bottom" style={{ marginBottom: 24, paddingHorizontal: 16 }} />}

                {pagination && (
                  <PaginationControls
                    pagination={pagination}
                    onPageChange={handlePageChange}
                    loading={loading}
                  />
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
  // paddingBottom: Platform.OS === 'web' ? 0 : 90,
  },
  listContent: {
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
  blogGrid: {
    width: '100%',
  },
  desktopBlogItem: {
    width: '100%',
  },
  // Desktop Header
  desktopHeader: {
    paddingHorizontal: 40,
    paddingTop: 40,
    paddingBottom: 20,
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
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
  // Search
  searchContainer: {
    paddingTop: HEADER_HEIGHT,
    paddingBottom: 12,
  },
  desktopSearchContainer: {
    paddingTop: 40,
    paddingBottom: 10,
    maxWidth: 800,
    width: '100%',
    alignSelf: 'center',
  },
  // Categories
  categoriesContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginBottom:20,
    gap: 6,
  },
  desktopCategoriesContainer: {
    paddingHorizontal: 0,
    paddingVertical: 12,
    paddingBottom: 20,
  },
  desktopContentContainer: {
    paddingHorizontal: 40,
    maxWidth: 1000,
    width: '100%',
    alignSelf: 'center',
  },
  categoryChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    marginRight: 6,
  },
  categoryChipActive: {
    backgroundColor: Colors.light.primary,
    borderColor: Colors.light.primary,
  },
  categoryChipText: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    fontWeight: '500',
  },
  categoryChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  desktopBlogCard: {
    marginBottom: 20,
    maxWidth: 1000,
    width: '100%',
    alignSelf: 'center',
  },
  desktopBlogImage: {
    width: 200, height: 150,
  },
  blogItemContainer: {
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 40,
  },
  emptyStateText: {
    fontSize: 16,
    color: Colors.light.textSecondary,
    textAlign: 'center',
    marginTop: 12,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.light.text,
    textAlign: 'center',
    marginTop: 16,
  },
  emptyStateSubtitle: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
});
