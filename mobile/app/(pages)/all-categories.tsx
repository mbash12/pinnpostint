import { MaterialIcons } from '@expo/vector-icons';
import { StyleSheet, ScrollView, Dimensions, TouchableOpacity, Platform, View, ActivityIndicator } from 'react-native';
import { NetworkImage } from '@/components/ui/network-image';
import { useState, useEffect } from 'react';
import { router } from 'expo-router';

import { Footer } from '@/components/footer';
import { MobilePlatformBanners } from '@/components/mobile-platform-banners';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { SubcategoryModal } from '@/components/ui/subcategory-modal';
import { useCategory } from '@/hooks/use-category';
import { categoriesService, platformAdsService } from '@/services';
import { Colors, WebShadows } from '@/constants/theme';
import { HEADER_HEIGHT, STANDARD_PADDING } from '@/constants/layout';
import type { Category, PlatformAd } from '@/types/api.types';
import { PlatformAdPosition } from '@/types/api.types';
import { SideBanners } from '@/components/home/side-banners';
import { useResponsive } from '@/hooks/use-responsive';

export default function AllCategoriesScreen() {
  const [showSubcategoryModal, setShowSubcategoryModal] = useState(false);
  const [selectedCategoryName, setSelectedCategoryName] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const { isDesktop, screenWidth } = useResponsive();
  const { setSelectedCategory, setSelectedSubcategory } = useCategory();
  
  // API state
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
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

  // Fetch categories on mount
  useEffect(() => {
    fetchCategories();
  }, []);
  
  const fetchCategories = async () => {
    try {
      setIsLoading(true);
      const response = await categoriesService.getCategories();
      if (response.success && response.data) {
        setCategories(response.data);
      }
    } catch (error) {
      setCategories([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Responsive grid configuration
  const GRID_COLUMNS = isDesktop ? 8 : 8; // Changed to 8 columns for both desktop and mobile to show 8 cards per row
  const ITEM_WIDTH = (screenWidth - 40) / GRID_COLUMNS - 8;

  const handleCategoryPress = (category: { id: string; name: string; image: string }) => {
    setSelectedCategoryName(category.name);
    setSelectedCategoryId(category.id);
    setShowSubcategoryModal(true);
  };

  const handleSubcategorySelect = (subcategory: any, categoryName: string) => {
    setSelectedCategory(categoryName);
    setSelectedSubcategory(subcategory);
    // Navigate to posts page with the selected category
    router.replace({
      pathname: '/(tabs)/browse',
      params: {
        subcategoryId: subcategory.id,
        category: categoryName
      }
    });
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {!isDesktop && <MobilePlatformBanners ads={platformAds} position="top" />}
        <View style={isDesktop ? styles.desktopHomeWrapper : null}>
          {isDesktop && (
            <SideBanners 
              ads={platformAds.filter(ad => ad.position === PlatformAdPosition.LEFT)} 
              position={PlatformAdPosition.LEFT} 
            />
          )}

          <View style={isDesktop ? styles.desktopMainContent : null}>
            {/* All Categories */}
            <ThemedView style={[styles.section, isDesktop && { paddingTop: 40 }]}>
              <ThemedView style={[styles.sectionContent, isDesktop && styles.desktopSectionContent]}>
                <View style={styles.sectionHeader}>
                  <View>
                    <ThemedText type="subtitle" style={styles.sectionTitle}>All Categories</ThemedText>
                    {isDesktop && (
                      <ThemedText style={styles.sectionSubtitle}>Browse through our wide range of categories</ThemedText>
                    )}
                  </View>
                </View>
              </ThemedView>
              
              {isLoading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color={Colors.light.primary} />
                  <ThemedText style={styles.loadingText}>Loading categories...</ThemedText>
                </View>
              ) : (
                isDesktop ? (
                  <View style={styles.desktopCategoriesWrapper}>
                    <View style={styles.desktopCategoriesGrid}>
                      {categories.length === 0 ? (
                        <View style={styles.emptyState}>
                          <MaterialIcons name="category" size={64} color={Colors.light.textSecondary} />
                          <ThemedText style={styles.emptyStateTitle}>No categories available</ThemedText>
                          <ThemedText style={styles.emptyStateSubtitle}>Check back later for new categories</ThemedText>
                        </View>
                      ) : categories.map((category: any) => (
                        <TouchableOpacity 
                          key={category.id} 
                          style={styles.desktopCategoryCard}
                          onPress={() => handleCategoryPress(category)}
                          activeOpacity={0.7}
                        >
                          <View style={styles.desktopCategoryImageWrapper}>
                            <NetworkImage
                              source={{ uri: category.image }}
                              style={styles.desktopCategoryImage}
                              contentFit="cover"
                              resizeMode="cover"
                            />
                          </View>
                          <ThemedView style={styles.desktopCategoryInfo}>
                            <ThemedText style={styles.desktopCategoryName}>{category.name}</ThemedText>
                          </ThemedView>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                ) : (
                  <ThemedView style={styles.categoriesGrid}>
                    {categories.length === 0 ? (
                      <View style={styles.emptyState}>
                        <MaterialIcons name="category" size={64} color={Colors.light.textSecondary} />
                        <ThemedText style={styles.emptyStateTitle}>No categories available</ThemedText>
                        <ThemedText style={styles.emptyStateSubtitle}>Check back later for new categories</ThemedText>
                      </View>
                    ) : categories.map((category: any) => (
                      <TouchableOpacity 
                        key={category.id} 
                        style={[styles.categoryCard, { width: ITEM_WIDTH, height: ITEM_WIDTH + 40 }]}
                        onPress={() => handleCategoryPress(category)}
                        activeOpacity={0.7}
                      >
                        <NetworkImage
                          source={{ uri: category.image }}
                          style={[styles.categoryImage, { height: ITEM_WIDTH }]}
                          contentFit="cover"
                          resizeMode="cover"
                        />
                        <ThemedView style={styles.categoryInfo}>
                          <ThemedText style={styles.categoryName}>{category.name}</ThemedText>
                        </ThemedView>
                      </TouchableOpacity>
                    ))}
                  </ThemedView>
                )
              )}
            </ThemedView>
          </View>

          {isDesktop && (
            <SideBanners 
              ads={platformAds.filter(ad => ad.position === PlatformAdPosition.RIGHT)} 
              position={PlatformAdPosition.RIGHT} 
            />
          )}
        </View>
        {!isDesktop && <MobilePlatformBanners ads={platformAds} position="bottom" style={{ marginVertical: 8, paddingHorizontal: 16 }} />}
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
  scrollView: {
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
  section: {
    paddingTop: HEADER_HEIGHT,
    paddingBottom: 100,
  },
  sectionContent: {
    paddingHorizontal: 20,
  },
  sectionHeader: {
    marginBottom: 40,
  },
  sectionTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },

  // Mobile Categories Grid
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  categoryCard: {
    marginBottom: 16,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
  },
  categoryImage: {
    width: '100%',
    borderRadius: 12,
  },
  categoryInfo: {
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
    height: 40,
  },
  categoryName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
    textAlign: 'center',
    lineHeight: 20,
  },

  // Desktop Styles
  desktopSection: {
    paddingTop: 40,
    paddingBottom: 80,
  },
  desktopSectionContent: {
    paddingHorizontal: 40,
    maxWidth: 1000,
    width: '100%',
    alignSelf: 'center',
  },
  desktopCategoriesWrapper: {
    maxWidth: 1000,
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: 40,
  },
  desktopCategoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'flex-start',
  },
  desktopCategoryCard: {
    width: '10%', /* Changed from 23% to ~10% to show 8 cards per row */
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    overflow: 'hidden',
    boxShadow: WebShadows.medium,
    elevation: 1,
  },
  desktopCategoryImageWrapper: {
    position: 'relative',
    width: '100%',
    aspectRatio: 1,
  },
  desktopCategoryImage: {
    width: '100%',
    height: '100%',
  },
  desktopCategoryInfo: {
    padding: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  desktopCategoryName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333333',
    textAlign: 'center',
    marginBottom: 2,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: Colors.light.textSecondary,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
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
