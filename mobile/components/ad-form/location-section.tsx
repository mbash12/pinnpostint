import { View, StyleSheet } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { GoogleLocationPicker } from '@/components/ui/google-location-picker';
import { Colors } from '@/constants/theme';
import { AdLocation } from '@/types/location.types';

interface LocationSectionProps {
  formData: {
    location?: AdLocation;
  };
  errors: { [key: string]: string };
  onInputChange: (field: string, value: AdLocation) => void;
}

export function LocationSection({
  formData,
  errors,
  onInputChange,
}: LocationSectionProps) {
  return (
    <View style={styles.section}>
      <ThemedText style={styles.sectionTitle}>Location Details</ThemedText>

      <GoogleLocationPicker
        initialLocation={formData.location}
        onLocationSelect={(location) => onInputChange('location', location as AdLocation)}
        height={400}
        variant="ad"
      />

      <View style={styles.infoBox}>
        <ThemedText style={styles.infoTitle}>Quick Tip</ThemedText>
        <ThemedText style={styles.infoText}>
          Tap anywhere on the map to instantly move the pin. Works great on touchscreens!
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    paddingHorizontal: 20,
    paddingVertical: 24,
    backgroundColor: '#FFFFFF',
    zIndex: 10,
    position: 'relative',
    overflow: 'visible',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.light.text,
    marginBottom: 20,
  },
  infoBox: {
    marginTop: 16,
    padding: 16,
    backgroundColor: Colors.light.primaryLight,
    borderRadius: 10,
    borderLeftWidth: 4,
    borderLeftColor: Colors.light.primary,
  },
  infoTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 6,
  },
  infoText: {
    fontSize: 14,
    lineHeight: 20,
    color: Colors.light.textSecondary,
  },
});
