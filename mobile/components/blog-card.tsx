import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, TouchableOpacity } from 'react-native';
import { NetworkImage } from '@/components/ui/network-image';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';

export type BlogCardProps = {
  id: string;
  slug: string;
  title: string;
  description: string;
  category: string;
  publishedAt?: string;
  image?: string;
  onPress: (slug: string) => void;
  containerStyle?: object;
  imageStyle?: object;
  showDescription?: boolean;
  isMobile?: boolean;
};

export function BlogCard({
  id,
  slug,
  title,
  description,
  category,
  publishedAt,
  image,
  onPress,
  containerStyle,
  imageStyle,
  showDescription,
  isMobile,
}: BlogCardProps) {
  const shouldShowDescription = showDescription !== undefined ? showDescription : true;
  return (
    <TouchableOpacity
      style={[styles.blogCard, containerStyle]}
      onPress={() => onPress(slug)}
    >
      {image ? (
        <NetworkImage
          source={{ uri: image }}
          style={[styles.blogImage, imageStyle]}
          contentFit="cover"
          resizeMode="cover"

        />
      ) : (
        <ThemedView style={[styles.blogImage, imageStyle]} />
      )}
      <ThemedView style={styles.blogContent}>
        <LinearGradient
          colors={[Colors.light.gradientStart, Colors.light.gradientEnd]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.categoryGradient}
        >
          <ThemedText style={styles.blogCategory}>{category}</ThemedText>
        </LinearGradient>
        <ThemedText style={[styles.blogTitle, isMobile && styles.mobileBlogTitle]} numberOfLines={2}>{title}</ThemedText>
        {publishedAt && (
          <ThemedText style={styles.blogDate}>
            {new Date(publishedAt).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'short',
              day: 'numeric'
            })}
          </ThemedText>
        )}
        {shouldShowDescription && (
          <ThemedText style={styles.blogDescription} numberOfLines={3}>{description}</ThemedText>
        )}
      </ThemedView>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  blogCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
  },
  blogImage: {
    width: 160,
    height: 120, // 5:4 ratio
    borderRadius: 12,
    // Additional properties to ensure proper cover behavior on Android
    overflow: 'hidden',
  },
  blogContent: {
    flex: 1,
    paddingHorizontal: 12,
    justifyContent: 'flex-start',
  },
  blogCategory: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    margin: 0,
    alignSelf: 'flex-start',
  },
  categoryGradient: {
    borderRadius: 20,
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  blogTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 4,
    lineHeight: 24,
  },
  mobileBlogTitle: {
    fontSize: 16, // Smaller font size for mobile
  },
  blogDescription: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    lineHeight: 20,
    flex: 1, // Allow description to take remaining space
  },
  blogDate: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    marginBottom: 4,
  },
});
