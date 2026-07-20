import { StyleSheet, View, ScrollView, TouchableOpacity, Platform, Dimensions } from 'react-native';
import { NetworkImage } from '@/components/ui/network-image';
import { useState, useEffect } from 'react';
import { router, useLocalSearchParams } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { SearchBar } from '@/components/search-bar';
import { Footer } from '@/components/footer';
import { MobilePlatformBanners } from '@/components/mobile-platform-banners';

import { AuthProtection } from '@/components/auth-protection';
import { SideBanners } from '@/components/home/side-banners';
import { Colors, WebShadows } from '@/constants/theme';
import { categoriesService, platformAdsService } from '@/services';
import type { Subcategory, PlatformAd } from '@/types/api.types';
import { PlatformAdPosition } from '@/types/api.types';
import { adDataStorage } from '@/utils/ad-data-storage';

export default function SelectSubcategoryScreen() {
  const { categoryId } = useLocalSearchParams<{
    categoryId: string;
  }>();

  const [searchQuery, setSearchQuery] = useState('');
  const [screenWidth, setScreenWidth] = useState(Dimensions.get('window').width);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [categoryName, setCategoryName] = useState('');
  const [categoryPlaceholder, setCategoryPlaceholder] = useState<string | undefined>(undefined);
  const [platformAds, setPlatformAds] = useState<PlatformAd[]>([]);
  const [isLoadingPlatformAds, setIsLoadingPlatformAds] = useState(true);

  const isDesktop = Platform.OS === 'web' && screenWidth > 768;

  useEffect(() => {
    const onChange = (result: any) => {
      setScreenWidth(result.window.width);
    };

    const dimensionsHandler = Platform.OS === 'web'
      ? Dimensions.addEventListener('change', onChange)
      : null;

    fetchPlatformAds();
    fetchSubcategories();

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

  const fetchSubcategories = async () => {
    try {
      if (!categoryId) return;
      setIsLoading(true);
      const response = await categoriesService.getCategorySubcategories(String(categoryId));
      if (response.success && response.data) {
        setSubcategories(response.data);
        if (response.data.length > 0 && response.data[0].categoryId) {
          const catResponse = await categoriesService.getCategories();
          if (catResponse.success && catResponse.data) {
            const category = catResponse.data.find(c => c.id === categoryId);
            if (category) {
              setCategoryName(category.name);
              setCategoryPlaceholder((category as any).adPlaceholder);
            }
          }
        }
      } else {
        setSubcategories([]);
      }
    } catch (e) {
      setSubcategories([]);
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

  const handleSubcategoryPress = async (subcategory: any) => {
    try {
      // Clear any existing ad data if it's for a different subcategory
      const storedData = await adDataStorage.retrieve();
      if (storedData && storedData.subcategoryId !== String(subcategory.id)) {
        await adDataStorage.clear();
      }
    } catch (e) {
      // Silent fail - we'll handle it in the next screen anyway
    }

    router.push({
      pathname: '/(pages)/create-ad/ad-form',
      params: {
        categoryId: categoryId,
        subcategoryId: String(subcategory.id),
        categoryPlaceholder: categoryPlaceholder
      }
    });
  };

  // Filter subcategories based on search query
  const displaySubcategories = subcategories as any[];
  const filteredSubcategories = displaySubcategories.filter((subcategory: any) =>
    subcategory.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Grid configuration for desktop
  const NUM_COLUMNS = isDesktop ? 2 : 1;
  const rows = [];
  for (let i = 0; i < filteredSubcategories.length; i += NUM_COLUMNS) {
    rows.push(filteredSubcategories.slice(i, i + NUM_COLUMNS));
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
              <ThemedText style={desktopStyles.desktopTitle}>Select Subcategory</ThemedText>
              <ThemedText style={desktopStyles.desktopSubtitle}>
                Choose a subcategory for your {categoryName} ad
              </ThemedText>
            </View>

            {/* Search Bar */}
            <SearchBar
              value={searchQuery}
              onChangeText={handleSearch}
              onClear={handleClearSearch}
              placeholder="Search subcategories..."
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
                  {row.map((subcategory) => (
                    <TouchableOpacity
                      key={subcategory.id}
                      style={desktopStyles.subcategoryCard}
                      onPress={() => handleSubcategoryPress(subcategory)}
                      activeOpacity={0.7}
                    >
                      {subcategory.image ? (
                        <NetworkImage
                          source={{ uri: subcategory.image }}
                          style={desktopStyles.subcategoryImage}
                          placeholder={require('@/assets/images/placeholder.png')}
                        />
                      ) : (
                        <View style={[desktopStyles.subcategoryImage, { backgroundColor: '#F0F0F0' }]} />
                      )}
                      <View style={desktopStyles.subcategoryInfo}>
                        <ThemedText style={desktopStyles.subcategoryName}>{subcategory.name}</ThemedText>
                        <ThemedText style={desktopStyles.subcategoryDescription}>{subcategory.description || ''}</ThemedText>
                      </View>
                      <View style={desktopStyles.arrowContainer}>
                        <ThemedText style={desktopStyles.arrow}>›</ThemedText>
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
            <ThemedText style={styles.title}>Select Subcategory</ThemedText>
            <ThemedText style={styles.subtitle}>
              Choose a subcategory for your {categoryName} ad
            </ThemedText>
          </View>

          <MobilePlatformBanners ads={platformAds} position="top" style={{ marginVertical: 8, paddingHorizontal: 16 }} />

          {/* Search Bar */}
          <SearchBar
            value={searchQuery}
            onChangeText={handleSearch}
            onClear={handleClearSearch}
            placeholder="Search subcategories..."
            containerStyle={styles.searchContainer}
            showFilter={false}
          />

          {/* Subcategories List */}
          <View style={styles.subcategoriesList}>
            {filteredSubcategories.map((subcategory) => (
              <TouchableOpacity
                key={subcategory.id}
                style={styles.subcategoryCard}
                onPress={() => handleSubcategoryPress(subcategory)}
                activeOpacity={0.7}
              >
                {subcategory.image ? (
                  <NetworkImage
                    source={{ uri: subcategory.image }}
                    style={styles.subcategoryImage}
                    placeholder={require('@/assets/images/placeholder.png')}
                  />
                ) : (
                  <View style={[styles.subcategoryImage, { backgroundColor: '#F0F0F0' }]} />
                )}
                <View style={styles.subcategoryInfo}>
                  <ThemedText style={styles.subcategoryName}>{subcategory.name}</ThemedText>
                  <ThemedText style={styles.subcategoryDescription}>{subcategory.description || ''}</ThemedText>
                </View>
                <View style={styles.arrowContainer}>
                  <ThemedText style={styles.arrow}>›</ThemedText>
                </View>
              </TouchableOpacity>
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
  subcategoriesList: {
    width: '100%',
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  subcategoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#F0F0F0',
    overflow: 'hidden',
  },
  subcategoryImage: {
    width: 80,
    height: 80,
    backgroundColor: '#F0F0F0',
  },
  subcategoryInfo: {
    flex: 1,
    padding: 16,
  },
  subcategoryName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 4,
  },
  subcategoryDescription: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    lineHeight: 18,
  },
  arrowContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  arrow: {
    fontSize: 18,
    color: Colors.light.textSecondary,
    fontWeight: '600',
  },
});

// Desktop Styles
const desktopStyles = StyleSheet.create({
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
  subcategoryCard: {
    width: 'calc(50% - 8px)',
    marginHorizontal: 4,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F0F0F0',
    overflow: 'hidden',
    boxShadow: WebShadows.soft,
    elevation: 1,
  },
  subcategoryImage: {
    width: 80,
    height: 80,
    backgroundColor: '#F0F0F0',
  },
  subcategoryInfo: {
    flex: 1,
    padding: 16,
  },
  subcategoryName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 4,
  },
  subcategoryDescription: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    lineHeight: 18,
  },
  arrowContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  arrow: {
    fontSize: 18,
    color: Colors.light.textSecondary,
    fontWeight: '600',
  },
});
