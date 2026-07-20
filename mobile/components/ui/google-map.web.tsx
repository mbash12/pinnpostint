import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';

import { Colors } from '@/constants/theme';
import { ThemedText } from '@/components/themed-text';
import config from '@/config/environment';

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

declare global {
  interface Window {
    google: any;
    initGoogleMap: () => void;
  }
}

export function GoogleMap({
  latitude,
  longitude,
  height = 300,
  interactive = false,
  onLocationSelect,
  onMapReady,
}: GoogleMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Ensure coordinates are always numbers
  const lat = typeof latitude === 'string' ? parseFloat(latitude) : (latitude ?? 28.6139);
  const lng = typeof longitude === 'string' ? parseFloat(longitude) : (longitude ?? 77.2090);

  useEffect(() => {
    const apiKey = config.external.googleMapsApiKey;
    if (!apiKey || apiKey === 'your_google_maps_api_key') {
      setError('Google Maps API Key is missing or invalid');
      return;
    }

    const loadGoogleMaps = () => {
      if (window.google && window.google.maps) {
        setIsLoaded(true);
        return;
      }

      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
      script.async = true;
      script.defer = true;
      script.onload = () => setIsLoaded(true);
      script.onerror = () => setError('Failed to load Google Maps script');
      document.head.appendChild(script);
    };

    loadGoogleMaps();
  }, []);

  useEffect(() => {
    if (!isLoaded || !mapRef.current || !window.google) return;

    const center = { lat, lng };
    const map = new window.google.maps.Map(mapRef.current, {
      center,
      zoom: 13,
      interactive: interactive,
      disableDefaultUI: !interactive,
      zoomControl: interactive,
      gestureHandling: interactive ? 'auto' : 'none',
    });

    const marker = new window.google.maps.Marker({
      position: center,
      map,
      draggable: interactive,
    });

    if (interactive) {
      map.addListener('click', (e: any) => {
        const clickedLat = e.latLng.lat();
        const clickedLng = e.latLng.lng();
        if (onLocationSelect) {
          onLocationSelect({ latitude: clickedLat, longitude: clickedLng });
        }
      });

      marker.addListener('dragend', () => {
        const position = marker.getPosition();
        if (onLocationSelect) {
          onLocationSelect({ latitude: position.lat(), longitude: position.lng() });
        }
      });
    }

    if (onMapReady) {
      onMapReady();
    }
  }, [isLoaded, lat, lng, interactive]);

  if (error) {
    return (
      <View style={[styles.errorContainer, { height }]}>
        <ThemedText style={styles.errorText}>{error}</ThemedText>
      </View>
    );
  }

  return (
    <View style={[styles.container, { height }]}>
      {!isLoaded && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={Colors.light.primary} />
          <ThemedText style={styles.loadingText}>Loading Google Maps...</ThemedText>
        </View>
      )}
      <div 
        ref={mapRef} 
        style={{ height: '100%', width: '100%' }} 
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(248, 249, 250, 0.8)',
    zIndex: 1,
  },
  loadingText: {
    marginTop: 8,
    fontSize: 14,
    color: Colors.light.textSecondary,
  },
  errorContainer: {
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFF5F5',
    borderWidth: 1,
    borderColor: '#FED7D7',
    padding: 20,
  },
  errorText: {
    color: '#C53030',
    textAlign: 'center',
    fontSize: 14,
  },
});
