/**
 * Map Test Page
 * A page to test Google Maps implementation
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { GoogleAdMap } from '@/components/ui/google-ad-map';
import { GoogleLocationPicker } from '@/components/ui/google-location-picker';

export default function MapTestPage() {
  const testLocation = {
    latitude: 28.6139,
    longitude: 77.2090,
  };

  const handleLocationSelect = (location: any) => {
    console.log('Location selected:', location);
  };

  return (
    <View style={styles.container}>
      <ThemedText style={styles.title}>Map Test Page</ThemedText>

      <View style={styles.section}>
        <ThemedText style={styles.sectionTitle}>Ad Map (Read-only)</ThemedText>
        <GoogleAdMap
          latitude={testLocation.latitude}
          longitude={testLocation.longitude}
          height={200}
        />
      </View>

      <View style={styles.section}>
        <ThemedText style={styles.sectionTitle}>Interactive Map Picker</ThemedText>
        <GoogleLocationPicker
          onLocationSelect={handleLocationSelect}
          initialLocation={testLocation}
          height={400}
          variant="header"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    gap: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  section: {
    gap: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
});
