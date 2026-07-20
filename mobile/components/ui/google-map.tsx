import React, { useRef, useState, useEffect } from 'react';
import { View, StyleSheet, ActivityIndicator, Platform, NativeModules } from 'react-native';
import { Colors } from '@/constants/theme';
import { ThemedText } from '@/components/themed-text';
import Constants from 'expo-constants';

// Only import MapView on native platforms - use lazy loading
let MapView: any = null;
let Marker: any = null;
let PROVIDER_GOOGLE: any = null;
let mapsLoaded = false;

const loadMapsModule = () => {
  if (mapsLoaded) return;

  // Return early on web
  if (Platform.OS === 'web') {
    mapsLoaded = true;
    return;
  }

  // Check if we are in Expo Go
  // executionEnvironment 'storeClient' usually means Expo Go
  const isExpoGo = Constants.appOwnership === 'expo' || 
                    (Constants as any).executionEnvironment === 'storeClient';

  // In New Architecture, TurboModules are accessed differently, 
  // but if the module is missing, react-native-maps's internal calls to 
  // TurboModuleRegistry.getEnforcing will crash the app during 'require'.
  
  // We check NativeModules as a hint. If it's missing from NativeModules AND we are in Expo Go,
  // we definitely shouldn't try to require it.
  const hasNativeModuleHint = NativeModules.RNMaps || 
                               NativeModules.AirGoogleMaps || 
                               NativeModules.RNMapsAirModule ||
                               NativeModules.RNMapsAirModule_TurboModule; // Potential turbo module name

  if (isExpoGo && !hasNativeModuleHint) {
    console.log('[GoogleMap] Detected Expo Go without native maps hint. Skipping require to prevent crash.');
    mapsLoaded = true;
    return;
  }

  try {
    // Final check: if we are on Android/iOS, try to require only if we really expect it to be there.
    // If it still crashes here, it means the Invariant Violation is thrown during module evaluation
    // and is not being caught by this try-catch block (which can happen in some RN versions/configs).
    const maps = require('react-native-maps');

    if (maps) {
      MapView = maps.default || maps;
      Marker = maps.Marker;
      PROVIDER_GOOGLE = maps.PROVIDER_GOOGLE;
      mapsLoaded = true;
    }
  } catch (error) {
    console.log('[GoogleMap] Error requiring react-native-maps:', error instanceof Error ? error.message : String(error));
    mapsLoaded = true;
  }
};

interface GoogleMapProps {
  latitude: number;
  longitude: number;
  height?: number;
  interactive?: boolean;
  onLocationSelect?: (location: {
    latitude: number;
    longitude: number;
    address?: any;
    displayName?: string;
  }) => void;
  onMapReady?: () => void;
}

export function GoogleMap({
  latitude,
  longitude,
  height = 300,
  interactive = false,
  onLocationSelect,
  onMapReady,
}: GoogleMapProps) {
  const mapRef = useRef<MapView>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [mapsAvailable, setMapsAvailable] = useState<boolean | null>(null);

  // Load maps module on mount
  useEffect(() => {
    loadMapsModule();
    setMapsAvailable(MapView !== null);
  }, []);

  const region = {
    latitude: latitude,
    longitude: longitude,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  };

  useEffect(() => {
    if (mapRef.current && !isLoading) {
      mapRef.current.animateToRegion(region, 500);
    }
  }, [latitude, longitude]);

  const handleMapReady = () => {
    setIsLoading(false);
    if (onMapReady) {
      onMapReady();
    }
  };

  const handlePress = (e: any) => {
    if (interactive && onLocationSelect) {
      const { latitude, longitude } = e.nativeEvent.coordinate;
      onLocationSelect({ latitude, longitude });
    }
  };

  // Show loading while checking maps availability
  if (mapsAvailable === null) {
    return (
      <View style={[styles.container, styles.fallbackContainer, { height }]}>
        <ActivityIndicator size="large" color={Colors.light.primary} />
      </View>
    );
  }

  // Show fallback message if MapView is not available (e.g., in Expo Go)
  if (!mapsAvailable) {
    return (
      <View style={[styles.container, styles.fallbackContainer, { height }]}>
        <ThemedText style={styles.fallbackText}>
          {Platform.OS === 'web'
            ? 'Map is available on web browsers'
            : 'Please use a development build to view maps. Expo Go does not support react-native-maps.'}
        </ThemedText>
      </View>
    );
  }

  return (
    <View style={[styles.container, { height }]}>
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        initialRegion={region}
        scrollEnabled={interactive}
        zoomEnabled={interactive}
        rotateEnabled={interactive}
        pitchEnabled={interactive}
        onMapReady={handleMapReady}
        onPress={handlePress}
      >
        <Marker
          coordinate={{ latitude, longitude }}
          draggable={interactive}
          onDragEnd={(e) => {
            if (onLocationSelect) {
              onLocationSelect({
                latitude: e.nativeEvent.coordinate.latitude,
                longitude: e.nativeEvent.coordinate.longitude,
              });
            }
          }}
          title="Selected Location"
        />
      </MapView>

      {isLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={Colors.light.primary} />
          <ThemedText style={styles.loadingText}>Loading Google Maps...</ThemedText>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#F0F0F0',
  },
  fallbackContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#F8F9FA',
  },
  fallbackText: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    textAlign: 'center',
  },
  map: {
    flex: 1,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(240, 240, 240, 0.9)',
    zIndex: 10,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: Colors.light.textSecondary,
  },
});
