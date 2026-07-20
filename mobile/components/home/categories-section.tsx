import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Dimensions, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { NetworkImage } from '@/components/ui/network-image';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, WebShadows } from '@/constants/theme';

const { width } = Dimensions.get('window');

interface Category {
  id: string;
  name: string;
  image: string;
}

interface CategoriesSectionProps {
  categories: Category[];
  isDesktop: boolean;
  onCategoryPress: (category: Category) => void;
}

export function CategoriesSection({ categories, isDesktop, onCategoryPress }: CategoriesSectionProps) {
  const ITEM_WIDTH = isDesktop ? width / 8 - 8 : width / 5 - 10; // 8 items per row on desktop, 5 on mobile

  return (
    <ThemedView style={[styles.section, isDesktop && styles.desktopSection]}>
      <ThemedView style={[styles.sectionContent, isDesktop && styles.desktopSectionContent]}>
        {/* Promo Header */}
        <View style={styles.promoHeader}>
          <View style={styles.promoBadge}>
            <ThemedText style={styles.promoText}>BUY</ThemedText>
            <View style={styles.promoDot} />
            <ThemedText style={styles.promoText}>SELL</ThemedText>
            <View style={styles.promoDot} />
            <ThemedText style={styles.promoText}>RENT</ThemedText>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <View style={{ flex: 1 }}>
            <ThemedText type="subtitle" style={[styles.sectionTitle, !isDesktop && styles.mobileSectionTitle, isDesktop && styles.desktopSectionTitle]}>Browse Categories</ThemedText>
            {isDesktop && (
              <ThemedText style={styles.sectionSubtitle}>Explore our wide range of categories</ThemedText>
            )}
          </View>
        </View>
      </ThemedView>

      {isDesktop ? (
        <View style={styles.desktopCategoriesWrapper}>
          <View style={styles.desktopCategoriesGrid}>
            {categories.map((category) => (
              <TouchableOpacity
                key={category.id}
                style={styles.desktopCategoryCard}
                onPress={() => onCategoryPress(category)}
                activeOpacity={0.7}
              >
                <View style={styles.desktopCategoryImageWrapper}>
                  <NetworkImage
                    source={{ uri: category.image }}
                    style={styles.desktopCategoryImage}
                    contentFit="cover"
                    resizeMode="cover"
                  />
                </View>
                <ThemedText style={styles.desktopCategoryName}>{category.name}</ThemedText>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoriesContainer}
        >
          {categories.map((category) => (
            <TouchableOpacity
              key={category.id}
              style={[styles.categoryItem, { width: ITEM_WIDTH, marginRight: 10 }]}
              onPress={() => onCategoryPress(category)}
              activeOpacity={0.7}
            >
              <NetworkImage
                source={{ uri: category.image }}
                style={[styles.categoryImage, { width: ITEM_WIDTH - 8, height: ITEM_WIDTH - 8 }]}
                contentFit="cover"
                resizeMode="cover"
              />
              <ThemedText style={styles.categoryName}>{category.name}</ThemedText>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  section: {
    // paddingTop: 24,
    // paddingBottom: 20,
  },
  sectionContent: {
    paddingHorizontal: 20,
  },
  promoHeader: {
    alignItems: 'center',
    marginBottom: 24,
    marginTop: 20,
  },
  promoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2', // Very light red
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: 'rgba(204, 22, 20, 0.1)',
  },
  promoText: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.light.primary,
    letterSpacing: 2,
  },
  promoDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: Colors.light.primary,
    marginHorizontal: 12,
    opacity: 0.5,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    marginBottom: 16, // Increased from 16 to 32 for more space
  },
  sectionTitle: {
    color: '#000000',
    fontSize: 24, // Default for mobile
    fontWeight: '700',
    lineHeight: 24,
    marginBottom: 8, // Consistent spacing with subtitle
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#666',
    lineHeight: 16,
    marginTop: 0, // Title already has marginBottom
  },

  // Mobile Categories
  categoriesContainer: {
    paddingHorizontal: 16,
  },
  categoryItem: {
    alignItems: 'center',
  },
  categoryImage: {
    borderRadius: 10,
    marginBottom: 5,
    // Additional properties to ensure proper cover behavior on Android
    overflow: 'hidden',
  },
  categoryName: {
    fontSize: 11,
    textAlign: 'center',
    color: '#808080',
    fontWeight: '500',
    lineHeight: 13,
  },

  seeAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  seeAllText: {
    fontSize: 14,
    color: Colors.light.primary,
    fontWeight: '600',
  },

  // Desktop Categories
  desktopSection: {
    paddingTop: 60, // Adjusted to 60 for better top spacing
    paddingBottom: 60, // Increased from 40 to 60 for more space before next section
  },
  desktopSectionContent: {
    paddingHorizontal: 40,
    maxWidth: 1200,
    width: '100%',
    alignSelf: 'center',
  },
  desktopCategoriesWrapper: {
    maxWidth: 1200,
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: 40,
  },
  desktopCategoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 20, // Reduced gap for tighter spacing
    justifyContent: 'center',
    marginTop:20,
  },
  desktopCategoryCard: {
    width: '14.2%', /* Adjusted to 14.2% for category cards */
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
    boxShadow: WebShadows.soft,
    elevation: 1,
  },
  desktopCategoryImageWrapper: {
    position: 'relative',
    width: '100%',
    aspectRatio: 1,
  },
  desktopCategoryImage: {
    width: '100%',
    height: '100%',
    // Additional properties to ensure proper cover behavior on Android
    overflow: 'hidden',
  },
  desktopCategoryName: {
    fontSize: 14, /* Increased from 12 to 14 */
    fontWeight: '600',
    color: '#000',
    textAlign: 'center',
    lineHeight: 16, /* Increased from 14 to 16 */
    paddingVertical: 10, /* Increased from 6 to 10 */
    paddingHorizontal: 8, /* Increased from 6 to 8 */
  },
  mobileSectionTitle: {
    fontSize: 18, // Smaller size for mobile
    lineHeight: 18,
  },
  desktopSectionTitle: {
    fontSize: 28, // Larger for desktop
    lineHeight: 28,
  },
});
