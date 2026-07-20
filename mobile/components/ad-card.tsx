import { StyleSheet, View, Platform, Pressable } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { NetworkImage } from '@/components/ui/network-image';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { useState, useEffect } from 'react';

import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import { getDaysRemaining } from '@/utils/date-utils';
import { getAdPlaceholder } from '@/constants/placeholders';

export type AdCardProps = {
  id: string;
  slug: string;
  title: string;
  description?: string;
  location: string;
  price: string;
  discountedPrice?: string;
  image: string;
  publisherName?: string;
  category?: string;
  subcategory?: string;
  categoryPlaceholder?: string;
  status?: string;
  expiresAt?: string;
  onPress: (slug: string) => void;
  onFavorite?: (id: string) => void;
  isFavorite?: boolean;
  containerStyle?: object;
  imageStyle?: object;
};

export function AdCard({
  id,
  slug,
  title,
  description,
  location,
  price,
  discountedPrice,
  image,
  publisherName,
  category,
  subcategory,
  categoryPlaceholder,
  status,
  expiresAt,
  onPress,
  onFavorite,
  isFavorite = false,
  containerStyle,
  imageStyle,
}: AdCardProps) {
  const [showLocation, setShowLocation] = useState(true);
  const fadeAnim = useSharedValue(1);

  // Determine if ad is expired based on date
  const daysLeft = expiresAt ? getDaysRemaining(expiresAt) : 1;
  const isExpiredByDate = expiresAt ? daysLeft < 0 : false;
  
  // Effective status for UI display
  const effectiveStatus = (status === 'APPROVED' && isExpiredByDate) ? 'EXPIRED' : status;


  // Cycle between location and publisher name
  useEffect(() => {
    if (publisherName) {
      const interval = setInterval(() => {
        fadeAnim.value = withTiming(0, { duration: 200 });
        setTimeout(() => {
          setShowLocation(prev => !prev);
          fadeAnim.value = withTiming(1, { duration: 200 });
        }, 200);
      }, 2500);
      return () => clearInterval(interval);
    }
  }, [publisherName]);

  const handleHeartPress = () => {
    onFavorite?.(id);
  };

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: fadeAnim.value,
  }));

  const placeholderImage = getAdPlaceholder(category, subcategory, categoryPlaceholder);
  const displayImage = image || placeholderImage;

  return (
    <Pressable
      style={[styles.adCard, containerStyle]}
      onPress={() => onPress(slug)}
    >
      <View style={styles.imageContainer}>
        {displayImage ? (
          <NetworkImage
            source={{ uri: displayImage }}
            style={[styles.adImage, imageStyle]}
            contentFit="cover"
            resizeMode="cover"

          />
        ) : (
          <View style={styles.placeholderContainer}>
            <MaterialIcons name="image" size={48} color={Colors.light.textSecondary} />
          </View>
        )}
        <LinearGradient
          colors={['rgba(0, 0, 0, 0.4)', 'transparent']}
          start={{ x: 1, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.gradientOverlay}
        />
        {(
          <Pressable
            style={styles.favoriteButton}
            onPress={handleHeartPress}
          >
            <MaterialIcons
              name={isFavorite ? "favorite" : "favorite-border"}
              size={18}
              color={isFavorite ? Colors.light.primary : "#FFFFFF"}
            />
          </Pressable>
        )}
      </View>
      <View style={styles.contentContainer}>
        <ThemedText style={styles.adTitle} numberOfLines={1}>{title}</ThemedText>
        {description && (
          <ThemedText style={styles.adDescription} numberOfLines={1}>{description}</ThemedText>
        )}
        {(category || subcategory) && (
          <ThemedText style={styles.categoryText} numberOfLines={1}>
            {/* {category} */}
            {subcategory}
          </ThemedText>
        )}
        {(price && price !== '0' && price !== '₹0' && price.toLowerCase() !== 'not available' && price.toLowerCase() !== 'n/a') && (
          <View style={styles.priceRow}>
            {discountedPrice ? (
              <View style={styles.priceContainer}>
                <ThemedText style={styles.adPriceOriginal}>{price}</ThemedText>
                <ThemedText style={styles.adPrice}>{discountedPrice}</ThemedText>
              </View>
            ) : (
              <ThemedText style={styles.adPrice}>{price}</ThemedText>
            )}
          </View>
        )}
      </View>
      <View style={styles.bottomInfoContainer}>
        <Animated.View style={animatedStyle}>
          {showLocation ? (
            <View style={styles.infoItem}>
              <MaterialIcons name="location-on" size={12} color={Colors.light.textSecondary} />
              <ThemedText style={styles.infoText} numberOfLines={1}>{location}</ThemedText>
            </View>
          ) : publisherName ? (
            <View style={styles.infoItem}>
              <MaterialIcons name="person" size={12} color={Colors.light.textSecondary} />
              <ThemedText style={styles.infoText} numberOfLines={1}>{publisherName}</ThemedText>
            </View>
          ) : null}
        </Animated.View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  adCard: {
    width: '100%',
    marginBottom: 16,
  },
  imageContainer: {
    position: 'relative',
    width: '100%',
  },
  adImage: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 16,
    backgroundColor: Colors.light.backgroundSecondary,
    // Additional properties to ensure proper cover behavior on Android
    overflow: 'hidden',
  },
  placeholderContainer: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 16,
    backgroundColor: Colors.light.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gradientOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 16,
  },
  favoriteButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  contentContainer: {
    paddingTop: 6,
    ...Platform.select({
      android: { paddingBottom: 0 },
      ios: { paddingBottom: 4 },
      web: { paddingBottom: 4 }
    })
  },
  adTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 4,
  },
  adDescription: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    marginBottom: 3,
    ...Platform.select({
      android: { lineHeight: 14 },
      ios: { lineHeight: 15 },
      web: { lineHeight: 15 }
    })
  },
  categoryText: {
    fontSize: 12,
    color: Colors.light.primary,
    marginBottom: 3,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 0,
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 3,
  },
  adLocation: {
    fontSize: 11,
    color: Colors.light.textSecondary,
    marginLeft: 4,
    flex: 1,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  adPriceOriginal: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    textDecorationLine: 'line-through',
  },
  adPrice: {
    fontSize: 15,
    fontWeight: 'bold',
    color: Colors.light.primary,
  },
  bottomInfoContainer: {
    paddingHorizontal: 0,
    paddingVertical: 0,
    ...Platform.select({
      android: { height: 18 },
      ios: { height: 20 },
      web: { height: 20 }
    }),
    justifyContent: 'center',
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  infoText: {
    fontSize: 11,
    color: Colors.light.textSecondary,
    flex: 1,
    ...Platform.select({
      android: { lineHeight: 14 },
      ios: { lineHeight: 15 },
      web: { lineHeight: 15 }
    })
  },
});
