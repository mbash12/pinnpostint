import { StyleSheet, Pressable, View } from 'react-native';
import { NetworkImage } from '@/components/ui/network-image';
import { MaterialIcons } from '@expo/vector-icons';

import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import { getAdStatusConfig } from '@/constants/status-config';
import { getDaysRemaining } from '@/utils/date-utils';
import { getAdPlaceholder } from '@/constants/placeholders';
import { shouldHidePrice } from '@/utils/price-formatter';

// Helper function to get status label
const getStatusLabel = (status?: string) => {
  switch (status) {
    case 'APPROVED':
      return 'Active';
    case 'REVIEW':
      return 'In Review';
    case 'REJECTED':
      return 'Rejected';
    case 'EXPIRED':
      return 'Expired';
    case 'UNPUBLISHED':
      return 'Unpublished';
    default:
      return status;
  }
};

export type EnhancedAdCardProps = {
  id: number;
  slug?: string;
  title: string;
  description?: string;
  location: string;
  price: string;
  discountedPrice?: string;
  image?: string;
  status?: string;
  views?: number;
  likes?: number;
  expiresAt?: string;
  category?: string;
  subcategory?: string;
  categoryPlaceholder?: string;
  onPress: (slug: string) => void;
  onFavorite?: (id: number) => void;
  onViewBookings?: (id: number) => void;
  isFavorite?: boolean;
  hideStats?: boolean;
  hideFavorite?: boolean;
  showBookings?: boolean;
  containerStyle?: object;
  imageStyle?: object;
};

export function EnhancedAdCard({
  id,
  slug,
  title,
  description,
  location,
  price,
  discountedPrice,
  image,
  status,
  views,
  likes,
  expiresAt,
  category,
  subcategory,
  categoryPlaceholder,
  onPress,
  onFavorite,
  onViewBookings,
  isFavorite = false,
  hideStats = false,
  hideFavorite = false,
  showBookings = false,
  containerStyle,
  imageStyle,
}: EnhancedAdCardProps) {
  // Determine if ad is expired based on date
  const daysLeft = expiresAt ? getDaysRemaining(expiresAt) : 1;
  const isExpiredByDate = expiresAt ? daysLeft < 0 : false; // daysLeft 0 means expires today, still active
  
  // Effective status for UI display
  const effectiveStatus = (status === 'APPROVED' && isExpiredByDate) ? 'EXPIRED' : status;

  const placeholderImage = getAdPlaceholder(category, subcategory, categoryPlaceholder);
  const displayImage = image || placeholderImage;

  return (
    <Pressable 
      style={[styles.adCard, containerStyle]}
      onPress={() => slug && onPress(slug)}
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
          <View style={[styles.adImage, imageStyle, styles.placeholderContainer]}>
            <MaterialIcons name="image" size={48} color={Colors.light.textSecondary} />
          </View>
        )}
        {effectiveStatus && (
          <View style={[styles.statusBadge, { backgroundColor: getAdStatusConfig(effectiveStatus).backgroundColor }]}>
            <ThemedText style={[styles.statusText, { color: getAdStatusConfig(effectiveStatus).textColor }]}>{getStatusLabel(effectiveStatus)}</ThemedText>
          </View>
        )}
        {onFavorite && !hideFavorite && (
          <Pressable style={styles.favoriteButton} onPress={() => onFavorite(id)}>
            <MaterialIcons 
              name={isFavorite ? "favorite" : "favorite-border"} 
              size={18} 
              color={isFavorite ? "#FF3B30" : "#FFFFFF"} 
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
        <View style={styles.locationContainer}>
          <MaterialIcons name="location-on" size={12} color={Colors.light.textSecondary} />
          <ThemedText style={styles.adLocation} numberOfLines={1} ellipsizeMode="tail">{location}</ThemedText>
        </View>
        {(!shouldHidePrice(price) || !shouldHidePrice(discountedPrice)) && (
          <View style={styles.priceContainer}>
            {discountedPrice && !shouldHidePrice(discountedPrice) ? (
              <>
                {!shouldHidePrice(price) && (
                  <ThemedText style={styles.originalPrice}>{price}</ThemedText>
                )}
                <ThemedText style={styles.adPrice}>{discountedPrice}</ThemedText>
              </>
            ) : !shouldHidePrice(price) ? (
              <ThemedText style={styles.adPrice}>{price}</ThemedText>
            ) : null}
          </View>
        )}
        {expiresAt && status === 'APPROVED' && (
          <ThemedText style={[
            styles.expirationText, 
            isExpiredByDate && { color: Colors.light.danger }
          ]}>
            {isExpiredByDate ? 'Expired' : `${daysLeft} day${daysLeft !== 1 ? 's' : ''} left`} ({new Date(expiresAt).toLocaleDateString()})
          </ThemedText>
        )}
        {status === 'EXPIRED' && (
          <ThemedText style={[styles.expirationText, { color: Colors.light.danger }]}>
            Ad Expired
          </ThemedText>
        )}
        {/* {status === 'REJECTED' && (
          <ThemedText style={[styles.expirationText, { color: Colors.light.danger }]}>
            Needs Edit
          </ThemedText>
        )}
        {status === 'REVIEW' && (
          <ThemedText style={[styles.expirationText, { color: Colors.light.warning }]}>
            Pending Review
          </ThemedText>
        )}
        {status === 'UNPUBLISHED' && (
          <ThemedText style={[styles.expirationText, { color: Colors.light.info || '#6B7280' }]}>
            Not Visible to Public
          </ThemedText>
        )} */}
        {!hideStats && (views !== undefined || likes !== undefined) && (
          <View style={styles.statsContainer}>
            {views !== undefined && (
              <View style={styles.statItem}>
                <MaterialIcons name="visibility" size={12} color={Colors.light.textSecondary} />
                <ThemedText style={styles.statText}>{views}</ThemedText>
              </View>
            )}
            {likes !== undefined && (
              <View style={styles.statItem}>
                <MaterialIcons name="favorite" size={12} color={Colors.light.textSecondary} />
                <ThemedText style={styles.statText}>{likes}</ThemedText>
              </View>
            )}
          </View>
        )}
        {showBookings && onViewBookings && (
          <Pressable 
            style={styles.bookingsButton}
            onPress={(e) => {
              e.stopPropagation();
              onViewBookings(id);
            }}
          >
            <MaterialIcons name="event" size={16} color={Colors.light.primary} />
            <ThemedText style={styles.bookingsText}>View Bookings</ThemedText>
          </Pressable>
        )}
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
    aspectRatio: 1, // Square aspect ratio
    borderRadius: 8,
    backgroundColor: Colors.light.backgroundSecondary,
    // Additional properties to ensure proper cover behavior on Android
    overflow: 'hidden',
  },
  placeholderContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 10,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  favoriteButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  contentContainer: {
    paddingTop: 8,
  },
  adTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 8,
  },
  adDescription: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    marginBottom: 6,
    lineHeight: 16,
  },
  categoryText: {
    fontSize: 12,
    color: Colors.light.primary,
    marginBottom: 6,
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  adLocation: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    marginLeft: 4,
    flex: 1,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  adPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.light.primary,
  },
  originalPrice: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.light.textSecondary,
    textDecorationLine: 'line-through',
  },
  expirationText: {
    fontSize: 11,
    color: Colors.light.textSecondary,
    marginBottom: 4,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    gap: 16,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    fontSize: 12,
    color: Colors.light.textSecondary,
  },
  bookingsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: Colors.light.primaryLight,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  bookingsText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.light.primary,
  },
});
