import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  TextInput,
  ActivityIndicator,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors } from '@/constants/theme';
import { ThemedText } from '@/components/themed-text';
import { useCurrentLocation } from '@/hooks/use-current-location';
import { geolocationService } from '@/services/geolocation.service';
import { locationService } from '@/services/location.service';
import { googleMapsService } from '@/services/google-maps.service';
import config from '@/config/environment';
import { useAlert } from '@/components/ui/custom-alert';
import { recentLocationsService } from '@/services/recent-locations.service';
import { GoogleLocationPicker } from './google-location-picker';
import {
  LocationSuggestion,
  RecentLocation,
  UnifiedLocationPickerMode,
  UnifiedLocationPickerProps,
} from '@/types/location';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export function UnifiedLocationPicker({
  visible,
  onClose,
  onLocationSelect,
  currentLocation,
  mode = 'bottom-sheet',
  showPreciseLocationPicker = false,
}: UnifiedLocationPickerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<LocationSuggestion[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSelecting, setIsSelecting] = useState(false);
  const [reverseGeocodedName, setReverseGeocodedName] = useState<string | null>(null);
  const [showPreciseModal, setShowPreciseModal] = useState(showPreciseLocationPicker);

  useEffect(() => {
    if (visible) {
      setShowPreciseModal(showPreciseLocationPicker);
    }
  }, [visible, showPreciseLocationPicker]);

  const { location: currentGeoLocation, isLoading: locationLoading, refreshLocation } = useCurrentLocation({
    autoFetch: false,
  });

  const [recentLocations, setRecentLocations] = useState<RecentLocation[]>([]);
  const [recentLoading, setRecentLoading] = useState(false);

  // Load recent locations from local storage only
  useEffect(() => {
    if (visible) {
      loadRecentLocations();
    }
  }, [visible]);

  const loadRecentLocations = async () => {
    setRecentLoading(true);
    try {
      const locations = await recentLocationsService.getLocalRecentLocations();
      setRecentLocations(locations.slice(0, 5));
    } catch (error) {
      setRecentLocations([]);
    } finally {
      setRecentLoading(false);
    }
  };

  const { showAlert } = useAlert();

  // Refresh current location when popup opens and reverse geocode it
  useEffect(() => {
    if (visible) {
      refreshLocation();
      // Perform reverse geocoding to get the actual location name
      if (currentGeoLocation) {
        locationService.reverseGeocode(
          currentGeoLocation.coordinates.latitude,
          currentGeoLocation.coordinates.longitude
        ).then(result => {
          if (result) {
            setReverseGeocodedName(result.name);
          }
        }).catch(() => {
          setReverseGeocodedName(null);
        });
      }
    }
  }, [visible]);

  // Reset search query when modal closes
  useEffect(() => {
    if (!visible) {
      setSearchQuery('');
      setSearchResults([]);
    }
  }, [visible]);

  // Handle location search with debouncing
  useEffect(() => {
    const timeoutId = setTimeout(async () => {
      if (!searchQuery.trim()) {
        setSearchResults([]);
        setIsSearching(false);
        return;
      }

      setIsSearching(true);
      try {
        const results = await locationService.searchLocations(searchQuery, 5);
        setSearchResults(results);
      } catch (error) {
      } finally {
        setIsSearching(false);
      }
    }, 200);

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  // Handle current location selection
  const handleCurrentLocationSelect = async () => {
    setIsSelecting(true);
    try {
      const hasPermission = await geolocationService.requestLocationPermission();
      if (!hasPermission) {
        setIsSelecting(false);
        showAlert({
          title: 'Location Permission',
          message: 'Please enable location permissions to use your current location.',
          type: 'warning',
          buttons: [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Enable',
              onPress: () => handleCurrentLocationSelect(),
            },
          ],
        });
        return;
      }

      const freshLocation = await geolocationService.getGeolocation(true);
      if (freshLocation) {
        // Use reverse geocoding to get the actual location name
        const reverseGeocoded = await locationService.reverseGeocode(
          freshLocation.coordinates.latitude,
          freshLocation.coordinates.longitude
        );

        const locationData: LocationSuggestion = {
          id: `current_${Date.now()}`,
          name: reverseGeocoded?.name || freshLocation.address.city || 'Current Location',
          displayName: reverseGeocoded?.displayName || freshLocation.address.formatted || 'Current Location',
          latitude: freshLocation.coordinates.latitude,
          longitude: freshLocation.coordinates.longitude,
          address: {
            city: reverseGeocoded?.address.city || freshLocation.address.city,
            state: reverseGeocoded?.address.state || freshLocation.address.state,
            country: reverseGeocoded?.address.country || freshLocation.address.country || 'US',
            postalCode: reverseGeocoded?.address.postalCode || freshLocation.address.postalCode,
            formatted: reverseGeocoded?.displayName || freshLocation.address.formatted || 'Current Location',
          },
        };

        // Update the reverse geocoded name for display
        setReverseGeocodedName(locationData.name);

        // Save to recent locations (local storage only)
        await recentLocationsService.saveLocation({
          name: locationData.name,
          country: locationData.address.country,
          state: locationData.address.state || '',
          city: locationData.address.city,
        });

        // Refresh recent locations list
        await loadRecentLocations();

        onLocationSelect(locationData);
        onClose();
        setSearchQuery('');
      } else {
        setIsSelecting(false);
        showAlert({
          title: 'Unable to Detect Location',
          message: 'We could not detect your location. Please check your GPS settings or search for a location manually.',
          type: 'error',
        });
      }
    } catch (error) {
      setIsSelecting(false);
      const errorMessage = error instanceof Error ? error.message : 'Unable to get your current location';
      showAlert({
        title: 'Location Error',
        message: errorMessage,
        type: 'error',
      });
    }
  };

  // Handle location selection from search or recent locations
  const handleLocationSelect = async (location: LocationSuggestion) => {
    setIsSelecting(true);
    try {
      // If location has placeId but no coordinates, fetch place details
      let enrichedLocation = location;
      if (location.placeId && (location.latitude === 0 || location.longitude === 0)) {
        const details = await googleMapsService.getPlaceDetails(location.placeId.replace('google_', ''));
        if (details) {
          enrichedLocation = details;
        }
      }

      // Save to recent locations (local storage only)
      await recentLocationsService.saveLocation({
        name: enrichedLocation.name,
        country: enrichedLocation.address.country,
        state: enrichedLocation.address.state || '',
        city: enrichedLocation.address.city,
        latitude: enrichedLocation.latitude,
        longitude: enrichedLocation.longitude,
      });

      // Refresh recent locations list
      await loadRecentLocations();

      onLocationSelect(enrichedLocation);
      onClose();
      setSearchQuery('');
    } catch (error) {
    } finally {
      setIsSelecting(false);
    }
  };

  // Handle recent location selection
  const handleRecentLocationSelect = async (recentLocation: RecentLocation) => {
    const locationData: LocationSuggestion = {
      id: `recent_${recentLocation.id}`,
      name: recentLocation.name,
      displayName: recentLocation.address || recentLocation.name,
      latitude: recentLocation.latitude || 0,
      longitude: recentLocation.longitude || 0,
      address: {
        city: recentLocation.city,
        state: recentLocation.state,
        country: recentLocation.country,
        postalCode: recentLocation.postalCode,
        formatted: recentLocation.address || recentLocation.name,
      },
    };

    setIsSelecting(true);
    try {
      // Update usage in recent locations (local storage only)
      await recentLocationsService.updateLocationUsage(recentLocation.id);

      // Refresh recent locations list
      await loadRecentLocations();

      onLocationSelect(locationData);
      onClose();
      setSearchQuery('');
    } catch (error) {
    } finally {
      setIsSelecting(false);
    }
  };

  // Handle location selection from precise picker
  const handlePreciseLocationSelect = async (location: any) => {
    const locationData: LocationSuggestion = {
      id: `precise_${Date.now()}`,
      name: location.displayName || 'Selected Location',
      displayName: location.displayName || 'Selected Location',
      latitude: location.latitude,
      longitude: location.longitude,
      address: {
        city: location.address.city || '',
        state: location.address.state || '',
        country: location.address.country || 'IN',
        postalCode: location.address.postalCode || '',
        formatted: location.displayName || 'Selected Location',
      },
    };

    // Save to recent locations
    await recentLocationsService.saveLocation({
      name: locationData.name,
      country: locationData.address.country,
      state: locationData.address.state || '',
      city: locationData.address.city || '',
    });

    onLocationSelect(locationData);
    setShowPreciseModal(false);
    onClose();
  };

  // Render location item
  const renderLocationItem = (location: LocationSuggestion, isRecent = false) => (
    <TouchableOpacity
      key={location.id}
      style={styles.locationItem}
      onPress={() => handleLocationSelect(location)}
      disabled={isSelecting}
    >
      <View style={styles.locationIcon}>
        <MaterialIcons
          name={isRecent ? 'history' : 'location-on'}
          size={20}
          color={isRecent ? Colors.light.textSecondary : Colors.light.primary}
        />
      </View>
      <View style={styles.locationInfo}>
        <ThemedText style={styles.locationDetails} numberOfLines={3}>
          {location.displayName}
        </ThemedText>
      </View>
      {currentLocation?.id === location.id && (
        <MaterialIcons name="check-circle" size={20} color={Colors.light.primary} />
      )}
    </TouchableOpacity>
  );

  // Render recent location item
  const renderRecentLocationItem = (recentLocation: RecentLocation) => {
    // Create a formatted display name from the recent location data
    const displayName = [
      recentLocation.address,
      recentLocation.name,
      recentLocation.city,
      recentLocation.state,
      recentLocation.country,
    ].filter(Boolean).join(', ');

    return (
      <TouchableOpacity
        key={`recent_${recentLocation.id}`}
        style={styles.locationItem}
        onPress={() => handleRecentLocationSelect(recentLocation)}
        disabled={isSelecting}
      >
        <View style={styles.locationIcon}>
          <MaterialIcons name="history" size={20} color={Colors.light.textSecondary} />
        </View>
        <View style={styles.locationInfo}>
          <ThemedText style={styles.locationDetails} numberOfLines={3}>
            {displayName}
          </ThemedText>
        </View>
        <View style={styles.recentLocationMeta}>
          <ThemedText style={styles.recentLocationTime}>
            {new Date(recentLocation.lastUsed).toLocaleDateString()}
          </ThemedText>
          {currentLocation?.id === `recent_${recentLocation.id}` && (
            <MaterialIcons name="check-circle" size={20} color={Colors.light.primary} />
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const isDesktop = (Platform.OS === 'web' && Dimensions.get('window').width > 768) ||
    (Platform.OS !== 'web' && Dimensions.get('window').width > 768);

  const content = (
    <>
      {/* Search Bar - Always visible */}
      <View style={styles.searchContainer}>
        <MaterialIcons name="search" size={20} color={Colors.light.textSecondary} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search for a location..."
          placeholderTextColor={Colors.light.textSecondary}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <MaterialIcons name="clear" size={20} color={Colors.light.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Use Current Location - Always visible */}
        <TouchableOpacity
          style={styles.currentLocationCard}
          onPress={handleCurrentLocationSelect}
          disabled={locationLoading || isSelecting}
        >
          <View style={styles.currentLocationIcon}>
            {locationLoading || isSelecting ? (
              <ActivityIndicator size="small" color={Colors.light.primary} />
            ) : (
              <MaterialIcons name="my-location" size={24} color={Colors.light.primary} />
            )}
          </View>
          <View style={styles.currentLocationText}>
            <ThemedText style={styles.currentLocationTitle}>Use Current Location</ThemedText>
            <ThemedText style={styles.currentLocationSubtitle}>
              {reverseGeocodedName
                ? reverseGeocodedName
                : currentGeoLocation
                  ? `${currentGeoLocation.address.city || 'Current Location'}, ${currentGeoLocation.address.state || ''}`
                  : 'Tap to detect your location'}
            </ThemedText>
          </View>
          {!locationLoading && !isSelecting && currentGeoLocation && (
            <TouchableOpacity
              style={styles.refreshButton}
              onPress={refreshLocation}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <MaterialIcons name="refresh" size={20} color={Colors.light.primary} />
            </TouchableOpacity>
          )}
        </TouchableOpacity>

        {searchQuery.length === 0 && (
          <TouchableOpacity 
            style={styles.preciseLocationButton}
            onPress={() => setShowPreciseModal(true)}
          >
            <MaterialIcons name="map" size={20} color={Colors.light.primary} />
            <ThemedText style={styles.manualLocationText}>Select from map</ThemedText>
          </TouchableOpacity>
        )}

        {/* Search Results or Default Content */}
        {isSearching ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={Colors.light.primary} />
            <ThemedText style={styles.loadingText}>Searching...</ThemedText>
          </View>
        ) : searchQuery.length > 0 ? (
          <>
            {searchResults.length > 0 ? (
              <View style={styles.resultsContainer}>
                {searchResults.map((location) => renderLocationItem(location))}
              </View>
            ) : (
              <View style={styles.noResults}>
                <MaterialIcons name="location-off" size={48} color={Colors.light.textSecondary} />
                <ThemedText style={styles.noResultsText}>No locations found</ThemedText>
                <ThemedText style={styles.noResultsSubtext}>
                  Try searching with different keywords
                </ThemedText>
              </View>
            )}
          </>
        ) : (
          <>
            {/* Recent Locations */}
            <View style={styles.section}>
              <ThemedText style={styles.sectionTitle}>Recent Locations</ThemedText>
              {recentLoading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color={Colors.light.primary} />
                  <ThemedText style={styles.loadingText}>Loading...</ThemedText>
                </View>
              ) : recentLocations.length > 0 ? (
                recentLocations.map((location) => renderRecentLocationItem(location))
              ) : (
                <View style={styles.noRecentLocations}>
                  <ThemedText style={styles.noRecentText}>No recent locations</ThemedText>
                  <ThemedText style={styles.noRecentSubtext}>
                    Your recently used locations will appear here
                  </ThemedText>
                </View>
              )}
            </View>
          </>
        )}
      </ScrollView>
    </>
  );

  const renderMainContent = () => {
    if (mode === 'modal' && isDesktop) {
      return (
        <View style={styles.desktopModalOverlay}>
          <View style={styles.desktopModalContainer}>
            <KeyboardAvoidingView behavior="padding" style={styles.keyboardContainer}>
              {/* Header */}
              <View style={styles.header}>
                <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                  <MaterialIcons name="close" size={24} color={Colors.light.text} />
                </TouchableOpacity>
                <ThemedText style={styles.headerTitle}>Select Location</ThemedText>
                <View style={styles.placeholder} />
              </View>

              {content}
            </KeyboardAvoidingView>
          </View>
        </View>
      );
    }

    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardContainer}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <MaterialIcons name="close" size={24} color={Colors.light.text} />
            </TouchableOpacity>
            <ThemedText style={styles.headerTitle}>Select Location</ThemedText>
            <View style={styles.placeholder} />
          </View>

          {content}
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  };

  const renderPreciseModalContent = () => {
    if (isDesktop) {
      return (
        <View style={styles.desktopModalOverlay}>
          <View style={[styles.desktopModalContainer, { height: '80%', maxHeight: 750, maxWidth: 800 }]}>
            <View style={styles.header}>
              <TouchableOpacity 
                onPress={showPreciseLocationPicker ? onClose : () => setShowPreciseModal(false)} 
                style={styles.closeButton}
              >
                <MaterialIcons name="close" size={24} color={Colors.light.text} />
              </TouchableOpacity>
              <ThemedText style={styles.headerTitle}>Select from Map</ThemedText>
              <View style={styles.placeholder} />
            </View>
            <View style={[styles.content, { padding: 16, zIndex: 10, position: 'relative' }]}>
              <GoogleLocationPicker
                onLocationSelect={handlePreciseLocationSelect}
                height={500}
                variant="header"
              />
            </View>
          </View>
        </View>
      );
    }

    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <TouchableOpacity 
            onPress={showPreciseLocationPicker ? onClose : () => setShowPreciseModal(false)} 
            style={styles.closeButton}
          >
            <MaterialIcons name="close" size={24} color={Colors.light.text} />
          </TouchableOpacity>
          <ThemedText style={styles.headerTitle}>Select from Map</ThemedText>
          <View style={styles.placeholder} />
        </View>
        
        <View style={[styles.content, { padding: 16, zIndex: 10, position: 'relative' }]}>
          <GoogleLocationPicker
            onLocationSelect={handlePreciseLocationSelect}
            height={SCREEN_HEIGHT - 280}
            variant="header"
          />
        </View>
      </SafeAreaView>
    );
  };

  const renderContent = () => {
    if (showPreciseLocationPicker || showPreciseModal) {
      return renderPreciseModalContent();
    }
    return renderMainContent();
  };

  return (
    <Modal
      visible={visible}
      animationType={isDesktop && mode === 'modal' ? "fade" : "slide"}
      presentationStyle={isDesktop && mode === 'modal' ? "overFullScreen" : "pageSheet"}
      onRequestClose={() => {
        if (showPreciseModal) {
          setShowPreciseModal(false);
        } else {
          onClose();
        }
      }}
      transparent={isDesktop && mode === 'modal'}
    >
      {renderContent()}
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  keyboardContainer: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  closeButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  placeholder: {
    width: 32,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginTop: 16,
    paddingHorizontal: 16,
    backgroundColor: Colors.light.backgroundSecondary,
    borderRadius: 10,
    gap: 8,
  },
  searchIcon: {
    opacity: 0.6,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 12,
    color: Colors.light.text,
    borderWidth: 0,
    outlineWidth: 0,
    outlineColor: 'transparent',
  },
  content: {
    flex: 1,
  },
  currentLocationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 20,
    padding: 16,
    backgroundColor: Colors.light.primaryLight,
    borderRadius: 12,
    gap: 12,
  },
  currentLocationIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.light.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  currentLocationText: {
    flex: 1,
  },
  currentLocationTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  currentLocationSubtitle: {
    fontSize: 14,
    color: Colors.light.textSecondary,
  },
  refreshButton: {
    padding: 8,
    borderRadius: 16,
    backgroundColor: Colors.light.backgroundSecondary,
  },
  preciseLocationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.light.primary,
    gap: 8,
  },
  manualLocationText: {
    fontSize: 14,
    color: Colors.light.primary,
    fontWeight: '500',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginHorizontal: 20,
    marginBottom: 12,
  },
  resultsContainer: {
    paddingHorizontal: 20,
  },
  locationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 8,
    minHeight: 64,
  },
  locationIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.light.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  locationInfo: {
    flex: 1,
  },
  locationName: {
    fontSize: 15,
    fontWeight: '500',
    marginBottom: 2,
  },
  locationDetails: {
    fontSize: 14,
    color: Colors.light.text,
    lineHeight: 20,
  },
  recentLocationMeta: {
    alignItems: 'flex-end',
  },
  recentLocationTime: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    marginBottom: 2,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    gap: 8,
  },
  loadingText: {
    fontSize: 14,
    color: Colors.light.textSecondary,
  },
  noResults: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  noResultsText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  noResultsSubtext: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  noRecentLocations: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  noRecentText: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },
  noRecentSubtext: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    textAlign: 'center',
  },
  desktopModalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  desktopModalContainer: {
    width: '90%',
    maxWidth: 500,
    height: 600,
    borderRadius: 16,
    backgroundColor: Colors.light.background,
    overflow: 'hidden',
    ...Platform.select({
      web: {
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
      },
      default: {
        elevation: 2,
        shadowColor: 'rgba(0, 0, 0, 0.08)',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
      }
    }),
  },
});
