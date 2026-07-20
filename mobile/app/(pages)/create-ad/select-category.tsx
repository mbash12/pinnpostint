import { StyleSheet, View, ScrollView, Dimensions, TouchableOpacity, Platform } from 'react-native';
import { NetworkImage } from '@/components/ui/network-image';
import { useState, useEffect, useCallback } from 'react';
import { router, useFocusEffect } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { SearchBar } from '@/components/search-bar';
import { Footer } from '@/components/footer';
import { MobilePlatformBanners } from '@/components/mobile-platform-banners';

import { AuthProtection } from '@/components/auth-protection';
import { SideBanners } from '@/components/home/side-banners';
import { Colors, WebShadows } from '@/constants/theme';
import { categoriesService, platformAdsService } from '@/services';
import type { Category, PlatformAd } from '@/types/api.types';
import { PlatformAdPosition } from '@/types/api.types';
import { adDataStorage } from '@/utils/ad-data-storage';

const { width } = Dimensions.get('window');

// No dummy fallback – categories must come from API

export default function SelectCategoryScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const [screenWidth, setScreenWidth] = useState(Dimensions.get('window').width);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [platformAds, setPlatformAds] = useState<PlatformAd[]>([]);
  const [isLoadingPlatformAds, setIsLoadingPlatformAds] = useState(true);

  const isDesktop = Platform.OS === 'web' && screenWidth > 768;

  // Clear any existing ad data when entering the create-ad flow
  useFocusEffect(
    useCallback(() => {
      adDataStorage.clear();
    }, [])
  );

  useEffect(() => {
    const onChange = (result: any) => {
      setScreenWidth(result.window.width);
    };

    const dimensionsHandler = Platform.OS === 'web'
      ? Dimensions.addEventListener('change', onChange)
      : null;

    fetchPlatformAds();
    fetchCategories();

    return () => {
      if (dimensionsHandler) {
        dimensionsHandler.remove();
      }
    };
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

  const fetchCategories = async () => {
    try {
      setIsLoading(true);
      const response = await categoriesService.getCategories();
      if (response.success && response.data) {
        setCategories(response.data);
      } else {
        setCategories([]);
      }
    } catch (e) {
      setCategories([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = (text: string) => {
    setSearchQuery(text);
  };

  const handleClearSearch = () => {
    setSearchQuery('');
  };

  const handleCategoryPress = (category: any) => {
    router.push({
      pathname: '/(pages)/create-ad/select-subcategory',
      params: { 
        categoryId: String(category.id)
      }
    });
  };

  // Filter categories based on search query
  const displayCategories = categories as any[];
  const filteredCategories = displayCategories.filter((category: any) =>
    (category.name || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Grid configuration
  const NUM_COLUMNS = isDesktop ? 6 : 3;
  const CARD_WIDTH = isDesktop ? '15%' : (width - 64) / 3;
  const GAP = isDesktop ? 16 : 12;

  // Group items into rows
  const rows = [];
  for (let i = 0; i < filteredCategories.length; i += NUM_COLUMNS) {
    rows.push(filteredCategories.slice(i, i + NUM_COLUMNS));
  }

  if (isDesktop) {
    return (
      <AuthProtection>
          <ScrollView
            style={desktopStyles.container}
            contentContainerStyle={desktopStyles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Desktop Header */}
            <View style={desktopStyles.desktopHeader}>
              <ThemedText style={desktopStyles.desktopTitle}>Create New Ad</ThemedText>
              <ThemedText style={desktopStyles.desktopSubtitle}>
                Select main category for your ad
              </ThemedText>
            </View>

            {/* Search Bar */}
            <SearchBar
              value={searchQuery}
              onChangeText={handleSearch}
              onClear={handleClearSearch}
              placeholder="Search categories..."
              containerStyle={desktopStyles.searchContainer}
              showFilter={false}
            />

            {!isDesktop && <MobilePlatformBanners ads={platformAds} position="top" />}

            <View style={desktopStyles.desktopHomeWrapper}>
              {isDesktop && (
                <SideBanners
                  ads={platformAds.filter(ad => ad.position === PlatformAdPosition.LEFT)}
                  position={PlatformAdPosition.LEFT}
                />
              )}

              <View style={desktopStyles.desktopMainContent}>
                <View style={desktopStyles.contentWrapper}>
              {rows.map((row, rowIndex) => (
                <View key={rowIndex} style={desktopStyles.row}>
                  {row.map((category) => (
                    <TouchableOpacity
                      key={category.id}
                      style={desktopStyles.categoryCard}
                      onPress={() => handleCategoryPress(category)}
                      activeOpacity={0.7}
                    >
                      {category.image ? (
                        <NetworkImage
                          source={{ uri: category.image }}
                          style={desktopStyles.categoryImage}
                          placeholder={require('@/assets/images/placeholder.png')}
                        />
                      ) : (
                        <View style={[desktopStyles.categoryImage, { backgroundColor: '#F0F0F0' }]} />
                      )}
                      <View style={desktopStyles.categoryInfo}>
                        <ThemedText style={desktopStyles.categoryName}>{category.name}</ThemedText>
                        <ThemedText style={desktopStyles.categoryDescription}>{category.description || ''}</ThemedText>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              ))}
              </View>
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

      </AuthProtection>
    );
  }

  return (
    <AuthProtection>
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <ThemedText style={styles.title}>Create New Ad</ThemedText>
            <ThemedText style={styles.subtitle}>
              Select main category for your ad
            </ThemedText>
          </View>

          <MobilePlatformBanners ads={platformAds} position="top" style={{ marginVertical: 8, paddingHorizontal: 16 }} />

          {/* Search Bar */}
          <SearchBar
            value={searchQuery}
            onChangeText={handleSearch}
            onClear={handleClearSearch}
            placeholder="Search categories..."
            containerStyle={styles.searchContainer}
            showFilter={false}
          />

          {/* Categories Grid */}
          <View style={styles.categoriesContainer}>
            {rows.map((row, rowIndex) => (
              <View key={rowIndex} style={styles.row}>
                {row.map((category) => (
                  <TouchableOpacity
                    key={category.id}
                    style={styles.categoryCard}
                    onPress={() => handleCategoryPress(category)}
                    activeOpacity={0.7}
                  >
                    {category.image ? (
                      <NetworkImage
                        source={{ uri: category.image }}
                        style={styles.categoryImage}
                        placeholder={require('@/assets/images/placeholder.png')}
                      />
                    ) : (
                      <View style={[styles.categoryImage, { backgroundColor: '#F0F0F0' }]} />
                    )}
                    <View style={styles.categoryInfo}>
                      <ThemedText style={styles.categoryName}>{category.name}</ThemedText>
                      <ThemedText style={styles.categoryDescription}>{category.description || ''}</ThemedText>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            ))}
          </View>

          <MobilePlatformBanners ads={platformAds} position="bottom" style={{ marginTop: 4, marginBottom: 24, paddingHorizontal: 16 }} />
          <Footer />
        </ScrollView>

    </AuthProtection>
  );


}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    flexGrow: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 95,
    paddingBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.light.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.light.textSecondary,
    lineHeight: 22,
  },
  searchContainer: {
    marginHorizontal: 20,
    marginBottom: 0,
  },
  categoriesContainer: {
    width: '100%',
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 12,
    width: '100%',
  },
  categoryCard: {
    width: (width - 64) / 3,
    marginHorizontal: 6,
    backgroundColor: '#FAFAFA',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F0F0F0',
    overflow: 'hidden',
  },
  categoryImage: {
    width: '100%',
    height: 100,
    backgroundColor: '#F0F0F0',
  },
  categoryInfo: {
    padding: 12,
    alignItems: 'center',
  },
  categoryName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.text,
    textAlign: 'center',
    marginBottom: 4,
  },
  categoryDescription: {
    fontSize: 11,
    color: Colors.light.textSecondary,
    textAlign: 'center',
    lineHeight: 14,
  },
});

// Desktop Styles
const desktopStyles = StyleSheet.create<any>({
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
  },
  desktopMainContent: {
    width: '100%',
    maxWidth: 1000,
    position: 'relative',
  },
  desktopHeader: {
    paddingHorizontal: 40,
    paddingTop: 40,
    paddingBottom: 20,
    alignItems: 'center',
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
  searchContainer: {
    marginHorizontal: 40,
    marginBottom: 32,
    maxWidth: 800,
    width: '100%',
    alignSelf: 'center',
  },
  scrollContent: {
    flexGrow: 1,
  },
  contentWrapper: {
    width: '100%',
    maxWidth: 1000,
    marginHorizontal: 'auto',
    paddingHorizontal: 40,
    paddingBottom: 40,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 16,
    width: '100%',
  },
  categoryCard: {
    width: 'calc(16.6667% - 14px)',
    marginHorizontal: 8,
    backgroundColor: '#FAFAFA',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F0F0F0',
    overflow: 'hidden',
    boxShadow: WebShadows.medium,
    elevation: 1,
  },
  categoryImage: {
    width: '100%',
    height: 120,
    backgroundColor: '#F0F0F0',
  },
  categoryInfo: {
    padding: 12,
    alignItems: 'center',
  },
  categoryName: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.light.text,
    textAlign: 'center',
    marginBottom: 4,
  },
  categoryDescription: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    textAlign: 'center',
    lineHeight: 16,
  },
});

