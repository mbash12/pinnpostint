import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, ActivityIndicator, TouchableOpacity, TextInput, Platform, ScrollView } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';

import { Colors } from '@/constants/theme';
import { ThemedText } from '@/components/themed-text';
import { googleMapsService } from '@/services/google-maps.service';
import { GoogleMap } from './google-map';
import { GradientButton } from './gradient-button';

interface GoogleLocationPickerProps {
  onLocationSelect: (location: {
    latitude: number;
    longitude: number;
    address: {
      road?: string;
      house_number?: string;
      city?: string;
      state?: string;
      country: string;
      postalCode?: string;
      formatted: string;
    };
    displayName: string;
  }) => void;
  initialLocation?: {
    latitude: number;
    longitude: number;
  };
  height?: number;
  variant?: 'header' | 'ad';
  showSearch?: boolean;
}

export function GoogleLocationPicker({
  onLocationSelect,
  initialLocation,
  height = 400,
  variant = 'header',
  showSearch = true,
}: GoogleLocationPickerProps) {
  const [selectedLocation, setSelectedLocation] = useState<{
    latitude: number;
    longitude: number;
    address?: any;
    displayName?: string;
  } | null>(null);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showResults, setShowResults] = useState(false);
  const lastSelectedName = useRef<string | null>(null);

  // Default location (Delhi, India)
  const DEFAULT_LOCATION = {
    latitude: 28.6139,
    longitude: 77.2090,
  };

  const currentLat = selectedLocation?.latitude || initialLocation?.latitude || DEFAULT_LOCATION.latitude;
  const currentLng = selectedLocation?.longitude || initialLocation?.longitude || DEFAULT_LOCATION.longitude;

  // Initialize selectedLocation from initialLocation on mount (for edit mode)
  useEffect(() => {
    if (initialLocation && !selectedLocation) {
      const initializeLocation = async () => {
        setIsLoadingLocation(true);
        try {
          const result = await googleMapsService.reverseGeocode(
            initialLocation.latitude,
            initialLocation.longitude
          );

          if (result) {
            setSelectedLocation({
              latitude: initialLocation.latitude,
              longitude: initialLocation.longitude,
              address: result.address,
              displayName: result.displayName,
            });
            setSearchQuery(result.displayName);
          } else {
            setSelectedLocation({
              latitude: initialLocation.latitude,
              longitude: initialLocation.longitude,
              displayName: 'Selected location',
            });
          }
        } catch (err) {
          console.error('Error initializing location:', err);
          setSelectedLocation({
            latitude: initialLocation.latitude,
            longitude: initialLocation.longitude,
            displayName: 'Selected location',
          });
        } finally {
          setIsLoadingLocation(false);
        }
      };

      initializeLocation();
    }
  }, [initialLocation]);

  // Debounced search logic using useEffect
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.length < 2 || searchQuery === lastSelectedName.current) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }

    const delayDebounceFn = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await googleMapsService.searchLocations(searchQuery, 5);
        setSearchResults(results);
        setShowResults(results.length > 0);
      } catch (err) {
        console.error('Autocomplete error:', err);
      } finally {
        setIsSearching(false);
      }
    }, 400);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  const handleLocationChange = async (lat: number, lng: number) => {
    setIsLoadingLocation(true);
    setError(null);

    try {
      const result = await googleMapsService.reverseGeocode(lat, lng);

      if (result) {
        const locationData = {
          latitude: lat,
          longitude: lng,
          address: result.address,
          displayName: result.displayName,
        };

        setSelectedLocation(locationData);
        lastSelectedName.current = result.displayName;
        setSearchQuery(result.displayName);

        // Auto-select if in ad variant
        if (variant === 'ad') {
          onLocationSelect({
            latitude: lat,
            longitude: lng,
            address: result.address as any,
            displayName: result.displayName,
          });
        }
      } else {
        setError('Could not get location details');
      }
    } catch (err) {
      setError('Failed to get location details');
    } finally {
      setIsLoadingLocation(false);
    }
  };

  const handleGetCurrentLocation = async () => {
    setIsLoadingLocation(true);
    setError(null);

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setError('Permission to access location was denied');
        setIsLoadingLocation(false);
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      const { latitude, longitude } = location.coords;
      handleLocationChange(latitude, longitude);
    } catch (err) {
      setError('Could not get your location');
      setIsLoadingLocation(false);
    }
  };

  const handleConfirmLocation = () => {
    if (selectedLocation) {
      setIsConfirming(true);
      onLocationSelect({
        latitude: selectedLocation.latitude,
        longitude: selectedLocation.longitude,
        address: selectedLocation.address as any,
        displayName: selectedLocation.displayName || '',
      });
    }
  };

  const handleSelectResult = async (result: any) => {
    setIsLoadingLocation(true);
    setShowResults(false);
    lastSelectedName.current = result.displayName;
    setSearchQuery(result.displayName);

    try {
      // Fetch full details (lat/lng) for the selected place
      const details = await googleMapsService.getPlaceDetails(result.placeId);
      
      if (details) {
        const locationData = {
          latitude: details.latitude,
          longitude: details.longitude,
          address: details.address,
          displayName: details.displayName,
        };

        setSelectedLocation(locationData);

        // Auto-select if in ad variant
        if (variant === 'ad') {
          onLocationSelect({
            latitude: details.latitude,
            longitude: details.longitude,
            address: details.address as any,
            displayName: details.displayName,
          });
        }
      }
    } catch (err) {
      console.error('Error selecting result details:', err);
      setError('Failed to get location details');
    } finally {
      setIsLoadingLocation(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Search Bar */}
      {showSearch && (
        <View style={styles.searchWrapper}>
          <View style={styles.searchContainer}>
            <MaterialIcons name="search" size={20} color={Colors.light.textSecondary} />
            <TextInput
              placeholder="Search for a location..."
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={(text) => {
                setSearchQuery(text);
                if (text !== lastSelectedName.current) {
                  lastSelectedName.current = null;
                }
              }}
              returnKeyType="search"
              autoFocus={variant === 'header'}
              autoCorrect={false}
              autoCapitalize="none"
              keyboardType="default"
              textContentType="none"
              placeholderTextColor={Colors.light.textSecondary}
            />
            {(isLoadingLocation || isSearching) && (
              <ActivityIndicator size="small" color={Colors.light.primary} />
            )}
          </View>

          {showResults && searchResults.length > 0 && (
            <View style={styles.resultsContainer}>
              <ScrollView 
                keyboardShouldPersistTaps="handled" 
                style={{ maxHeight: 250 }}
              >
                {searchResults.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.resultItem}
                    onPress={() => handleSelectResult(item)}
                  >
                    <MaterialIcons name="location-on" size={18} color={Colors.light.textSecondary} />
                    <View style={styles.resultTextContainer}>
                      <ThemedText style={styles.resultName} numberOfLines={1}>
                        {item.displayName}
                      </ThemedText>
                      <ThemedText style={styles.resultAddress} numberOfLines={1}>
                        {item.displayName}
                      </ThemedText>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
        </View>
      )}

      {/* Current Location Button - Only for Ad form */}
      {variant === 'ad' && (
        <TouchableOpacity
          style={styles.currentLocationButton}
          onPress={handleGetCurrentLocation}
          disabled={isLoadingLocation}
        >
          <MaterialIcons name="my-location" size={20} color={Colors.light.primary} />
          <ThemedText style={styles.currentLocationText}>Use Current Location</ThemedText>
        </TouchableOpacity>
      )}

      {/* Map Container */}
      <View style={styles.mapContainer}>
        <GoogleMap
          latitude={currentLat}
          longitude={currentLng}
          height={height}
          interactive={true}
          onLocationSelect={(location) => {
            handleLocationChange(location.latitude, location.longitude);
          }}
        />

        {/* Selected Location Overlay */}
        {selectedLocation && (
          <View style={styles.selectedLocationOverlay}>
            <MaterialIcons name="location-on" size={20} color={Colors.light.primary} />
            <ThemedText style={styles.selectedLocationText} numberOfLines={2}>
              {selectedLocation.displayName || selectedLocation.address?.formatted || 'Location selected'}
            </ThemedText>
          </View>
        )}
      </View>

      {/* Error Message */}
      {error && (
        <View style={styles.errorContainer}>
          <MaterialIcons name="error" size={20} color="#ef4444" />
          <ThemedText style={styles.errorText}>{error}</ThemedText>
        </View>
      )}

      {/* Confirm Button - Only for Header mode */}
      {variant === 'header' && (
        <View style={styles.confirmContainer}>
          <GradientButton
            title="Confirm This Location"
            onPress={handleConfirmLocation}
            disabled={!selectedLocation || isLoadingLocation || isConfirming}
            loading={isConfirming}
          />
        </View>
      )}

      {/* Instructions */}
      <View style={styles.instructions}>
        <ThemedText style={styles.instructionsText}>
          Tap on the map or drag the marker to select your location
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: 12,
    backgroundColor: Colors.light.background,
    overflow: 'visible',
    zIndex: 1,
  },
  searchWrapper: {
    zIndex: 3000, 
    position: 'relative',
    marginHorizontal: 0,
    overflow: 'visible',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.light.backgroundSecondary,
    borderRadius: 10,
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.light.border,
    zIndex: 3001,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    padding: 0,
    height: 24,
    color: Colors.light.text,
    backgroundColor: 'transparent',
    ...Platform.select({
      web: {
        outlineStyle: 'none',
      }
    })
  },
  resultsContainer: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    marginTop: 4,
    zIndex: 4000, 
    borderWidth: 1,
    borderColor: '#E9ECEF',
    overflow: 'hidden',
    ...Platform.select({
      web: {
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
      },
      default: {
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
      }
    })
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F8F9FA',
    gap: 12,
  },
  resultTextContainer: {
    flex: 1,
  },
  resultName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.text,
  },
  resultAddress: {
    fontSize: 12,
    color: Colors.light.textSecondary,
  },
  mapContainer: {
    position: 'relative',
    borderRadius: 12,
    overflow: 'hidden',
    flex: 1,
    minHeight: 300,
    zIndex: 1, 
  },
  selectedLocationOverlay: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 10,
    gap: 8,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    zIndex: 10,
  },
  selectedLocationText: {
    flex: 1,
    fontSize: 14,
    color: Colors.light.text,
    fontWeight: '500',
  },
  currentLocationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.light.primaryLight,
    borderRadius: 10,
    gap: 8,
    marginHorizontal: 0,
    zIndex: 1,
  },
  currentLocationText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.light.primary,
  },
  confirmContainer: {
    marginTop: 4,
    paddingHorizontal: 0,
    zIndex: 1,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fef2f2',
    borderRadius: 10,
    gap: 8,
    marginHorizontal: 0,
    zIndex: 1,
  },
  errorText: {
    fontSize: 14,
    color: '#ef4444',
  },
  instructions: {
    paddingHorizontal: 0,
    marginBottom: 8,
    zIndex: 1,
  },
  instructionsText: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    textAlign: 'center',
  },
});
