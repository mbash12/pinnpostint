import { MaterialIcons } from '@expo/vector-icons';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  showSeeAll?: boolean;
  onSeeAllPress?: () => void;
  style?: any;
}

export function SectionHeader({ title, subtitle, showSeeAll = false, onSeeAllPress, style }: SectionHeaderProps) {
  return (
    <View style={[styles.container, style]}>
      <View style={styles.textContainer}>
        <ThemedText type="subtitle" style={styles.title}>{title}</ThemedText>
        {subtitle && (
          <ThemedText style={styles.subtitle}>{subtitle}</ThemedText>
        )}
      </View>
      {showSeeAll && onSeeAllPress && (
        <TouchableOpacity style={styles.seeAllButton} onPress={onSeeAllPress}>
          <ThemedText style={styles.seeAllText}>See All</ThemedText>
          <MaterialIcons name="arrow-forward-ios" size={12} color={Colors.light.primary} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    color: '#000000',
    fontSize: 20, // Smaller for mobile
    fontWeight: '700',
    marginBottom: 8, // Consistent spacing with subtitle
  },
  subtitle: {
    fontSize: 14, // Consistent with other subtitles
    color: '#666',
    marginTop: 0, // Title already has marginBottom
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
});
