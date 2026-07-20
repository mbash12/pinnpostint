import React from 'react';
import { StyleSheet, View, Pressable, Platform } from 'react-native';
import { NetworkImage } from '@/components/ui/network-image';
import { MaterialIcons } from '@expo/vector-icons';
import { ThemedText } from '@/components/themed-text';
import { Colors, Shadows } from '@/constants/theme';
import { getAdPlaceholder } from '@/constants/placeholders';

export type CompactAdCardProps = {
  id: string;
  title: string;
  price: string;
  image?: string;
  category?: string;
  subcategory?: string;
  categoryPlaceholder?: string;
  location?: string;
  onPress?: () => void;
  containerStyle?: object;
  style?: object;
  imageStyle?: object;
};

export function CompactAdCard({
  id,
  title,
  price,
  image,
  category,
  subcategory,
  categoryPlaceholder,
  location,
  onPress,
  containerStyle,
  style,
  imageStyle,
}: CompactAdCardProps) {
  const placeholderImage = getAdPlaceholder(category, subcategory, categoryPlaceholder);
  const displayImage = image || placeholderImage;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.container,
        containerStyle,
        style,
        pressed && styles.pressed,
      ]}
      onPress={onPress}
    >
      <View style={[styles.imageContainer, imageStyle]}>
        {displayImage ? (
          <NetworkImage
            source={{ uri: displayImage }}
            style={styles.image}
            contentFit="cover"
          />
        ) : (
          <View style={styles.placeholderContainer}>
            <MaterialIcons name="image" size={20} color={Colors.light.textSecondary} />
          </View>
        )}
      </View>
      <View style={styles.content}>
        <ThemedText style={styles.title} numberOfLines={1}>{title}</ThemedText>
        <View style={styles.footer}>
          {(price && price !== '0' && price !== '₹0' && price.toLowerCase() !== 'not available' && price.toLowerCase() !== 'n/a') && (
            <ThemedText style={styles.price}>{price}</ThemedText>
          )}
          {location && (
            <View style={styles.locationContainer}>
              <MaterialIcons name="location-on" size={10} color={Colors.light.textSecondary} />
              <ThemedText style={styles.location} numberOfLines={1}>{location}</ThemedText>
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: Colors.light.background,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.light.border,
    padding: 6,
    gap: 10,
    width: '100%',
    maxWidth: 300,
    ...Shadows.subtle,
  },
  pressed: {
    opacity: 0.7,
  },
  imageContainer: {
    width: 50,
    height: 50,
    borderRadius: 6,
    overflow: 'hidden',
    backgroundColor: Colors.light.backgroundSecondary,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholderContainer: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 2,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 4,
  },
  price: {
    fontSize: 12,
    fontWeight: 'bold',
    color: Colors.light.primary,
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    flex: 1,
  },
  location: {
    fontSize: 10,
    color: Colors.light.textSecondary,
    flex: 1,
  },
});
