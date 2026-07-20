import { StyleSheet, View, Dimensions } from 'react-native';
import { AdCard } from '../ad-card';

const { width } = Dimensions.get('window');

interface Ad {
  id: string;
  slug: string;
  title: string;
  description?: string;
  location: string;
  price: string;
  image: string;
  category?: string;
  subcategory?: string;
  categoryPlaceholder?: string;
  status?: string;
  expiresAt?: string;
  isFavorite?: boolean;
}

interface AdGridProps {
  ads: Ad[];
  favorites?: string[];
  onAdPress: (slug: string) => void;
  onFavorite?: (adId: string) => void;
  isDesktop?: boolean;
  columns?: number;
  style?: any;
}

export function AdGrid({
  ads,
  favorites = [],
  onAdPress,
  onFavorite,
  isDesktop = false,
  columns = isDesktop ? 4 : 2,
  style,
}: AdGridProps) {
  const getCardWidth = () => {
    if (isDesktop) {
      // Desktop: calculate based on columns with gaps
      return `${(100 / columns) - 2}%`;
    }
    // Mobile: 2 columns with padding
    return (width - 40) / 2 - 8;
  };

  return (
    <View style={[
      styles.container,
      isDesktop && styles.desktopContainer,
      style
    ]}>
      {ads.map((ad) => (
        <AdCard
          key={ad.id}
          id={String(ad.id)}
          slug={ad.slug}
          title={ad.title}
          description={ad.description}
          location={ad.location}
          price={ad.price}
          image={ad.image}
          category={ad.category}
          subcategory={ad.subcategory}
          categoryPlaceholder={ad.categoryPlaceholder}
          status={ad.status}
          expiresAt={ad.expiresAt}
          onPress={onAdPress}
          onFavorite={onFavorite}
          isFavorite={ad.isFavorite || false}
          containerStyle={
            isDesktop
              ? { width: getCardWidth() }
              : { width: getCardWidth() }
          }
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  desktopContainer: {
    gap: 24,
    paddingHorizontal: 40,
    maxWidth: 1200,
    width: '100%',
    alignSelf: 'center',
  },
});
