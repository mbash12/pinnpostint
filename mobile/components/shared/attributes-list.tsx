import { MaterialIcons } from '@expo/vector-icons';
import { StyleSheet, View, TouchableOpacity, Linking, Platform } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';

interface Attribute {
  icon: string;
  label?: string;
  value: string;
  type?: string;
}

interface AttributesListProps {
  attributes: Attribute[];
  isDesktop?: boolean;
  style?: any;
}

export function AttributesList({ attributes, isDesktop = false, style }: AttributesListProps) {
  const handleDownload = (url: string) => {
    if (Platform.OS === 'web') {
      window.open(url, '_blank');
    } else {
      Linking.openURL(url).catch(() => {});
    }
  };

  return (
    <View style={[styles.container, isDesktop && styles.desktopContainer, style]}>
      {attributes.map((attr, index) => (
        <View key={index} style={styles.attributeRow}>
          <View style={styles.iconContainer}>
            <MaterialIcons name={attr.icon as any} size={18} color={Colors.light.primary} />
          </View>
          <View style={styles.contentContainer}>
            {attr.type === 'file' ? (
              <View style={styles.fileRow}>
                <ThemedText style={styles.attributeValue}>
                  {attr.label || 'File'}: 
                </ThemedText>
                <TouchableOpacity 
                  onPress={() => handleDownload(attr.value)}
                  style={styles.downloadButton}
                >
                  <ThemedText style={styles.downloadText}>Download/View</ThemedText>
                  <MaterialIcons name="file-download" size={16} color={Colors.light.primary} />
                </TouchableOpacity>
              </View>
            ) : (
              <ThemedText style={styles.attributeValue}>{attr.value}</ThemedText>
            )}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 12,
    marginHorizontal: 20,
    gap: 8,
  },
  desktopContainer: {
    backgroundColor: '#F8F9FA',
    padding: 16,
    marginHorizontal: 0,
    gap: 6,
  },
  attributeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
  },
  iconContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.light.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  contentContainer: {
    flex: 1,
  },
  attributeValue: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.light.text,
    lineHeight: 18,
  },
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  downloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.primary + '10',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  downloadText: {
    fontSize: 12,
    color: Colors.light.primary,
    fontWeight: '600',
  },
});
