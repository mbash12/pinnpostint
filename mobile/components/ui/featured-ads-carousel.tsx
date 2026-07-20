import React, { useState, useRef } from 'react';
import { View, StyleSheet, Dimensions, TouchableOpacity, ScrollView, NativeSyntheticEvent, NativeScrollEvent, Platform } from 'react-native';
import { NetworkImage } from '@/components/ui/network-image';
import { MaterialIcons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
} from 'react-native-reanimated';
import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import { Ad } from '@/services/ads.service';
import { formatPrice } from '@/utils/price-formatter';
import { getAdPlaceholder } from '@/constants/placeholders';

const { width: screenWidth } = Dimensions.get('window');

interface FeaturedAdsCarouselProps {
  ads: Ad[];
  itemWidth?: number;
  itemHeight?: number;
  onAdPress: (slug: string) => void;
}

export function FeaturedAdsCarousel({
  ads,
  itemWidth = screenWidth * 0.85, // Increase width to use more screen space
  itemHeight = 250, // Increase height for better visual impact
  onAdPress,
}: FeaturedAdsCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollX = useSharedValue(0);
  const scrollViewRef = useRef<ScrollView>(null);

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    scrollX.value = offsetX;

    // Update current index in real-time for better indicator tracking
    const index = Math.round(offsetX / itemWidth);
    if (index !== currentIndex && index >= 0 && index < ads.length) {
      setCurrentIndex(index);
    }
  };

  const handleMomentumScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(event.nativeEvent.contentOffset.x / itemWidth);
    setCurrentIndex(index);
  };

  const scrollToIndex = (index: number) => {
    setCurrentIndex(index);
    scrollViewRef.current?.scrollTo({
      x: index * itemWidth,
      animated: true,
    });
  };

  if (ads.length === 0) {
    return null;
  }

  return (
    <View style={[styles.container, { height: itemHeight + 24 }]}>
      <ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        onMomentumScrollEnd={handleMomentumScrollEnd}
        scrollEventThrottle={16}
        style={styles.scrollView}
        decelerationRate="fast"
        snapToInterval={itemWidth}
        snapToAlignment="center"
      >
        {ads.map((ad, index) => {
          const placeholderImage = getAdPlaceholder(ad.category?.name, ad.subcategory?.name, ad.category?.adPlaceholder);
          const displayImage = ad.images?.[0] || placeholderImage;

          return (
            <TouchableOpacity
              key={ad.id}
              style={[
                styles.adCard,
                {
                  width: itemWidth,
                  height: itemHeight,
                  marginHorizontal: 12, // Increase margin for better spacing
                },
              ]}
              onPress={() => onAdPress(ad.slug)}
              activeOpacity={0.85}
            >
              <View style={styles.imageContainer}>
                <NetworkImage
                  source={{ uri: displayImage }}
                  style={styles.adImage}
                  contentFit="cover"
                  resizeMode="cover"
                />
                {ad.isFeatured && (
                  <View style={styles.featuredBadge}>
                    <MaterialIcons name="star" size={14} color="#FFD700" />
                  </View>
                )}
                <View style={styles.priceTag}>
                  <ThemedText style={styles.priceTagText}>
                    {ad.price ? formatPrice(ad.price) : 'Contact'}
                  </ThemedText>
                </View>
              </View>
              <View style={styles.adContent}>
                <ThemedText style={styles.adTitle} numberOfLines={1}>
                  {ad.title}
                </ThemedText>
                <View style={styles.adLocation}>
                  <MaterialIcons name="location-on" size={16} color={Colors.light.textSecondary} />
                  <ThemedText style={styles.adLocationText} numberOfLines={1}>
                    {ad.locationFormatted || ad.locationCity || 'Location'}
                  </ThemedText>
                </View>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  scrollView: {
    flex: 1,
  },
  adCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16, // Increase border radius for more rounded corners
    overflow: 'hidden',
    marginHorizontal: 12, // This is now handled in the component props
    boxShadow: Platform.select({
      ios: '0px 4px 16px rgba(0, 0, 0, 0.1)',
      android: '0px 4px 16px rgba(0, 0, 0, 0.1)',
      default: '0px 4px 16px rgba(0, 0, 0, 0.1)',
    }),
    elevation: 2,
  },
  imageContainer: {
    position: 'relative',
    height: '60%', // Increase image height percentage
  },
  adImage: {
    width: '100%',
    height: '100%',
    // Additional properties to ensure proper cover behavior on Android
    overflow: 'hidden',
  },
  featuredBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 12,
    padding: 6,
  },
  priceTag: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    backgroundColor: Colors.light.primary,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  priceTagText: {
    color: '#FFFFFF',
    fontSize: 12, // Increase font size
    fontWeight: '700',
  },
  adContent: {
    padding: 12, // Increase padding
    height: '40%', // Decrease content height to balance with increased image height
    justifyContent: 'center', // Center content vertically since title is single line
  },
  adTitle: {
    fontSize: 14, // Increase font size
    fontWeight: '700', // Make bolder
    color: Colors.light.text,
    marginBottom: 6, // Increase spacing
    lineHeight: 18, // Increase line height
  },
  adLocation: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6, // Increase gap
  },
  adLocationText: {
    fontSize: 12, // Increase font size
    color: Colors.light.textSecondary,
  },
});