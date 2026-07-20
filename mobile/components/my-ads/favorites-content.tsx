import { StyleSheet, ScrollView, Dimensions, View, Platform } from 'react-native';
import { useState, useEffect } from 'react';

import { ThemedText } from '@/components/themed-text';
import { EnhancedAdCard } from '@/components/enhanced-ad-card';
import { Colors } from '@/constants/theme';
import { formatPrice, shouldHidePrice } from '@/utils/price-formatter';
import type { WishlistItem } from '@/types/api.types';

const { width } = Dimensions.get('window');

export type FavoritesContentProps = {
  searchQuery: string;
  favorites: WishlistItem[];
  onAdPress: (adSlug: string) => void;
  onFavorite: (adId: number) => void;
};

export function FavoritesContent({ searchQuery, favorites, onAdPress, onFavorite }: FavoritesContentProps) {
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
  const normalized = Array.isArray(favorites) ? favorites : [];
  const filteredFavorites = normalized.filter(item => {
    const ad = item.ad || ({} as any);
    const title = (ad.title || '').toLowerCase();
    const q = searchQuery.toLowerCase();
    return title.includes(q);
  });

  if (filteredFavorites.length === 0) {
    return (
      <View style={styles.emptyState}>
        <ThemedText style={styles.emptyText}>No favorites found</ThemedText>
        <ThemedText style={styles.emptySubtext}>Try adjusting your search</ThemedText>
      </View>
    );
  }

  return (
    <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
      <View style={[styles.adsGrid, isDesktop && styles.desktopAdsGrid]}>
        {filteredFavorites.map((item) => (
          <EnhancedAdCard
            key={item.id}
            id={typeof item.ad.id === 'string' ? parseInt(item.ad.id) : (item.ad.id as any)}
            slug={item.ad.slug}
            title={item.ad.title}
            location={item.ad.locationFormatted || item.ad.locationCity || 'Location'}
            price={!shouldHidePrice(item.ad.price) ? (typeof item.ad.price === 'number' ? formatPrice(item.ad.price) : (item.ad.price as any)) : ''}
            image={item.ad.images?.[0]}
            views={0}
            likes={0}
            category={item.ad.category?.name}
            subcategory={item.ad.subcategory?.name}
            categoryPlaceholder={item.ad.category?.adPlaceholder}
            status={item.ad.status}
            onPress={() => onAdPress(item.ad.slug)}
            onFavorite={onFavorite}
            isFavorite={true}
            hideStats={true}
            hideFavorite={true}
            containerStyle={isDesktop ? styles.desktopAdCard : { width: (width - 40) / 2 - 8 }}
          />
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
  },
  adsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  desktopAdsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 24,
    paddingHorizontal: 0,
    paddingVertical: 24,
    justifyContent: 'space-between',
  },
  desktopAdCard: {
    width: '23%',
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
});
