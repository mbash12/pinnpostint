import { StyleSheet, FlatList, Dimensions, View, Platform, ActivityIndicator } from 'react-native';
import { useState, useEffect } from 'react';
import { useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { EnhancedAdCard } from '@/components/enhanced-ad-card';
import { formatPrice, shouldHidePrice } from '@/utils/price-formatter';
import { Colors } from '@/constants/theme';
import type { Ad } from '@/types/api.types';

const { width } = Dimensions.get('window');

export type AdsContentProps = {
  searchQuery: string;
  ads: Ad[];
  onAdPress: (adSlug: string) => void;
  onFavorite?: (adId: number) => void;
  onLoadMore?: () => void;
  hasMore?: boolean;
  loadingMore?: boolean;
  isLoading?: boolean;
};

export function AdsContent({ searchQuery, ads, onAdPress, onFavorite, onLoadMore, hasMore, loadingMore, isLoading }: AdsContentProps) {
  const router = useRouter();
  const [screenWidth, setScreenWidth] = useState(Dimensions.get('window').width);
  const isDesktop = Platform.OS === 'web' && screenWidth > 768;

  useEffect(() => {
    const onChange = (result: any) => {
      setScreenWidth(result.window.width);
    };
    
    const dimensionsHandler = Platform.OS === 'web' 
      ? Dimensions.addEventListener('change', onChange)
      : null;
      
    return () => {
      if (dimensionsHandler) {
        dimensionsHandler.remove();
      }
    };
  }, []);
  
  const normalizedAds = Array.isArray(ads) ? ads : [];

  if (isLoading) {
    return (
      <View style={styles.loadingState}>
        <ActivityIndicator size="large" color={Colors.light.primary} />
        <ThemedText style={styles.loadingText}>Loading ads...</ThemedText>
      </View>
    );
  }

  if (normalizedAds.length === 0) {
    return (
      <View style={styles.emptyState}>
        <ThemedText style={styles.emptyText}>No ads found</ThemedText>
        <ThemedText style={styles.emptySubtext}>
          {searchQuery ? 'Try adjusting your search' : 'Create your first ad to get started'}
        </ThemedText>
      </View>
    );
  }

  return (
    <FlatList
      data={normalizedAds}
      keyExtractor={(item) => item.id.toString()}
      numColumns={isDesktop ? 4 : 2}
      key={isDesktop ? 'desktop' : 'mobile'}
      contentContainerStyle={[styles.adsGrid, isDesktop && styles.desktopAdsGrid]}
      columnWrapperStyle={!isDesktop ? styles.row : undefined}
      renderItem={({ item: ad }) => (
        <EnhancedAdCard
          id={typeof ad.id === 'string' ? parseInt(ad.id) : (ad.id as any)}
          slug={ad.slug || ad.id}
          title={ad.title}
          location={ad.locationFormatted || ad.locationCity || 'Location'}
          price={!shouldHidePrice(ad.price) ? formatPrice(ad.price) : ''}
          discountedPrice={ad.discountedPrice && !shouldHidePrice(ad.discountedPrice) ? formatPrice(ad.discountedPrice) : undefined}
          image={ad.images?.[0]}
          status={ad.status}
          views={ad.views || 0}
          likes={0}
          expiresAt={ad.expiresAt}
          category={ad.category?.name}
          subcategory={ad.subcategory?.name}
          categoryPlaceholder={ad.category?.adPlaceholder}
          onPress={() => onAdPress(ad.slug || ad.id)}
          hideFavorite={true}
          showBookings={false}
          containerStyle={isDesktop ? styles.desktopAdCard : { width: (width - 40 - 16) / 2 }}
        />
      )}
      ListFooterComponent={
        loadingMore ? (
          <ActivityIndicator size="large" color={Colors.light.primary} style={{ marginVertical: 20 }} />
        ) : null
      }
      onEndReached={onLoadMore}
      onEndReachedThreshold={0.5}
      showsVerticalScrollIndicator={false}
    />
  );
}

const styles = StyleSheet.create({
  adsGrid: {
    paddingHorizontal: 0,
    paddingVertical: 16,
  },
  desktopAdsGrid: {
    paddingHorizontal: 0,
    paddingVertical: 24,
  },
  row: {
    justifyContent: 'flex-start',
    marginBottom: 16,
    gap: 16,
    paddingHorizontal: 16,
  },
  desktopAdCard: {
    width: '23%',
    marginBottom: 16,
    marginRight: '2.67%',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.light.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    textAlign: 'center',
  },
  loadingState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: Colors.light.textSecondary,
  },
});
