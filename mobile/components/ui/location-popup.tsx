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
import { useRecentLocations } from '@/hooks/use-recent-locations';
import { geolocationService } from '@/services/geolocation.service';
import { locationsService } from '@/services/locations.service';
import { useAlert } from '@/components/ui/custom-alert';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export interface LocationData {
  id: string;
  name: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  city?: string;
  state?: string;
  country: string;
  postalCode?: string;
}

export interface LocationPopupProps {
  visible: boolean;
  onClose: () => void;
  onLocationSelect: (location: LocationData) => void;
  currentLocation?: LocationData;
}





export function LocationPopup({
  visible,
  onClose,
  onLocationSelect,
  currentLocation,
}: LocationPopupProps) {
  const [activeTab, setActiveTab] = useState<'current' | 'search'>('current');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<LocationData[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSelecting, setIsSelecting] = useState(false);
  const [popularLocations, setPopularLocations] = useState<LocationData[]>([]);

  const { location: currentGeoLocation, isLoading: locationLoading, fetchLocation, permissionGranted, refreshLocation } = useCurrentLocation({
    autoFetch: false,
  });

  const { recentLocations, isLoading: recentLoading } = useRecentLocations({
    autoLoad: false,
    limit: 5,
  });

  const { showAlert } = useAlert();

  // Refresh current location when popup opens
  useEffect(() => {
    if (visible) {
      refreshLocation();
      // Load popular locations
      loadPopularLocations();
    }
  }, [visible, refreshLocation]);

  // Load popular locations
  const loadPopularLocations = async () => {
    try {
      const resp = await locationsService.getLocations({ limit: 5 });
      if ((resp as any).success && (resp as any).data) {
        const locations = ((resp as any).data || []).map((loc: any) => ({
          id: loc.id,
          name: loc.name,
          state: typeof loc.state === 'object' ? loc.state.name : loc.state,
          country: loc.country,
          city: typeof loc.city === 'object' ? loc.city.name : loc.city,
        }));
        setPopularLocations(locations);
      }
    } catch (error) {
    }
  };

  // Handle location search
  const handleSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const resp = await locationsService.getLocations({ search: query, limit: 10 });
      if ((resp as any).success && (resp as any).data) {
        const results = ((resp as any).data || []).map((loc: any) => ({
          id: loc.id,
          name: loc.name,
          state: typeof loc.state === 'object' ? loc.state.name : loc.state,
          country: loc.country,
          city: typeof loc.city === 'object' ? loc.city.name : loc.city,
        }));
        setSearchResults(results);
      } else {
        setSearchResults([]);
      }
    } catch (error) {
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Debounced search
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      handleSearch(searchQuery);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, handleSearch]);

  // Handle current location selection
  const handleCurrentLocationSelect = async () => {
    setIsSelecting(true);
    try {
      // First, ensure we have permission
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
              text: 'Enable', onPress: () => {
                // Try again after user enables permission
                handleCurrentLocationSelect();
              }
            },
          ]
        });
        return;
      }

      // Force fetch fresh location data
      const freshLocation = await geolocationService.getGeolocation(true);
      if (freshLocation) {
        const locationData: LocationData = {
          id: 'current',
          name: `${freshLocation.address.city || 'Current Location'}, ${freshLocation.address.state || ''}`,
          address: freshLocation.address.formatted,
          latitude: freshLocation.coordinates.latitude,
          longitude: freshLocation.coordinates.longitude,
          city: freshLocation.address.city,
          state: freshLocation.address.state,
          country: freshLocation.address.country,
          postalCode: freshLocation.address.postalCode,
        };

        // Try to match with database location
        try {
          const cityName = freshLocation.address.city || '';
          if (cityName) {
            const resp = await locationsService.getLocations({
              search: cityName,
              limit: 1
            });

            if ((resp as any).success && (resp as any).data && (resp as any).data.length > 0) {
              const dbLocation = (resp as any).data[0];
              locationData.id = dbLocation.id; // Use database UUID
            }
          }
        } catch (error) {
        }

        // Save to recent locations (API disabled - using local storage only)
        // await saveLocation({
        //   name: locationData.name,
        //   address: locationData.address,
        //   latitude: locationData.latitude,
        //   longitude: locationData.longitude,
        //   city: locationData.city,
        //   state: locationData.state,
        //   country: locationData.country,
        //   postalCode: locationData.postalCode,
        //   isCurrentLocation: true,
        // });

        onLocationSelect(locationData);
        onClose();
      } else {
        setIsSelecting(false);
        showAlert({
          title: 'Unable to Detect Location',
          message: 'We could not detect your location. Please check your GPS settings or search for a location manually.',
          type: 'error'
        });
      }
    } catch (error) {
      setIsSelecting(false);
      const errorMessage = error instanceof Error ? error.message : 'Unable to get your current location';
      showAlert({
        title: 'Location Error',
        message: errorMessage,
        type: 'error'
      });
    }
  };

  // Handle location selection
  const handleLocationSelect = async (location: LocationData) => {
    setIsSelecting(true);
    try {
      // If it's a recent location or current location, try to find matching location in DB
      let finalLocation = location;

      if (location.id.startsWith('recent_') || location.id === 'current') {
        try {
          // Search for the location in the database by name
          const resp = await locationsService.getLocations({
            search: location.name.split(',')[0].trim(),
            limit: 1
          });

          if ((resp as any).success && (resp as any).data && (resp as any).data.length > 0) {
            const dbLocation = (resp as any).data[0];
            finalLocation = {
              ...location,
              id: dbLocation.id // Use the database UUID
            };
          }
        } catch (error) {
        }
      }

      // Save to recent locations if it's not a recent location already (API disabled)
      // if (!location.id.startsWith('recent_')) {
      //   await saveLocation({
      //     name: location.name,
      //     address: location.address,
      //     latitude: location.latitude,
      //     longitude: location.longitude,
      //     city: location.city,
      //     state: location.state,
      //     country: location.country,
      //     postalCode: location.postalCode,
      //     isCurrentLocation: false,
      //   });
      // } else {
      //   // Update usage count for existing recent location
      //   await updateLocationUsage(location.id);
      // }

      onLocationSelect(finalLocation);
      onClose();
      setSearchQuery('');
      setSearchResults([]);
    } catch (error) {
    } finally {
      setIsSelecting(false);
    }
  };

  // Render location item
  const renderLocationItem = ({ item }: { item: LocationData }) => (
    <TouchableOpacity
      style={styles.locationItem}
      onPress={() => handleLocationSelect(item)}
      disabled={isSelecting}
    >
      <View style={styles.locationIcon}>
        <MaterialIcons name="location-on" size={20} color={Colors.light.primary} />
      </View>
      <View style={styles.locationInfo}>
        <ThemedText style={styles.locationName}>{item.name}</ThemedText>
        <ThemedText style={styles.locationDetails}>
          {[item.state, item.country].filter(Boolean).join(', ')}
        </ThemedText>
      </View>
      {currentLocation?.id === item.id && (
        <MaterialIcons name="check-circle" size={20} color={Colors.light.primary} />
      )}
    </TouchableOpacity>
  );

  // Render recent location item
  const renderRecentLocationItem = ({ item }: { item: any }) => {
    const locationData: LocationData = {
      id: `recent_${item.id}`,
      name: item.name,
      address: item.address,
      latitude: item.latitude,
      longitude: item.longitude,
      city: item.city,
      state: item.state,
      country: item.country,
      postalCode: item.postalCode,
    };

    return (
      <TouchableOpacity
        style={styles.locationItem}
        onPress={() => handleLocationSelect(locationData)}
        disabled={isSelecting}
      >
        <View style={styles.locationIcon}>
          <MaterialIcons name="history" size={20} color={Colors.light.textSecondary} />
        </View>
        <View style={styles.locationInfo}>
          <ThemedText style={styles.locationName}>{item.name}</ThemedText>
          <ThemedText style={styles.locationDetails}>
            {[item.state, item.country].filter(Boolean).join(', ')}
          </ThemedText>
        </View>
        <View style={styles.recentLocationMeta}>
          <ThemedText style={styles.recentLocationTime}>
            {new Date(item.lastUsed).toLocaleDateString()}
          </ThemedText>
          {currentLocation?.id === `recent_${item.id}` && (
            <MaterialIcons name="check-circle" size={20} color={Colors.light.primary} />
          )}
        </View>
      </TouchableOpacity>
    );
  };

  // Render current location tab
  const renderCurrentLocationTab = () => (
    <View style={styles.tabContent}>
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
            {permissionGranted === false
              ? 'Enable location permission in settings'
              : currentGeoLocation
                ? `${currentGeoLocation.address.city || 'Current Location'}, ${currentGeoLocation.address.state || ''}`
                : 'Tap to detect your location'
            }
          </ThemedText>
        </View>
        {!locationLoading && !isSelecting && (
          <TouchableOpacity
            style={styles.refreshButton}
            onPress={refreshLocation}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <MaterialIcons name="refresh" size={20} color={Colors.light.primary} />
          </TouchableOpacity>
        )}
      </TouchableOpacity>

      <View style={styles.divider} />

      <ThemedText style={styles.sectionTitle}>Recent Locations</ThemedText>
      {recentLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={Colors.light.primary} />
          <ThemedText style={styles.loadingText}>Loading recent locations...</ThemedText>
        </View>
      ) : recentLocations.length > 0 ? (
        <View style={styles.listContainer}>
          {recentLocations.map((item) => renderRecentLocationItem({ item }))}
        </View>
      ) : (
        <View style={styles.noRecentLocations}>
          <MaterialIcons name="history" size={48} color={Colors.light.textSecondary} />
          <ThemedText style={styles.noRecentText}>No recent locations</ThemedText>
          <ThemedText style={styles.noRecentSubtext}>
            Your recently used locations will appear here
          </ThemedText>
        </View>
      )}
    </View>
  );

  // Render search tab
  const renderSearchTab = () => (
    <View style={styles.tabContent}>
      <View style={styles.searchContainer}>
        <MaterialIcons name="search" size={20} color={Colors.light.textSecondary} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search for a location..."
          placeholderTextColor={Colors.light.textSecondary}
          value={searchQuery}
          onChangeText={setSearchQuery}
          tabIndex={0}
          autoFocus
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <MaterialIcons name="clear" size={20} color={Colors.light.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {isSearching ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={Colors.light.primary} />
          <ThemedText style={styles.loadingText}>Searching...</ThemedText>
        </View>
      ) : searchResults.length > 0 ? (
        <View style={styles.listContainer}>
          {searchResults.map((item) => (
            <View key={item.id}>
              {renderLocationItem({ item })}
            </View>
          ))}
        </View>
      ) : searchQuery.length > 0 ? (
        <View style={styles.noResults}>
          <MaterialIcons name="location-off" size={48} color={Colors.light.textSecondary} />
          <ThemedText style={styles.noResultsText}>No locations found</ThemedText>
          <ThemedText style={styles.noResultsSubtext}>
            Try searching with different keywords
          </ThemedText>
        </View>
      ) : popularLocations.length > 0 ? (
        <>
          <ThemedText style={styles.sectionTitle}>Popular Locations</ThemedText>
          <View style={styles.listContainer}>
            {popularLocations.map((item) => (
              <View key={item.id}>
                {renderLocationItem({ item })}
              </View>
            ))}
          </View>
        </>
      ) : null}
    </View>
  );



  const isDesktop = (Platform.OS === 'web' && Dimensions.get('window').width > 768) ||
    (Platform.OS !== 'web' && Dimensions.get('window').width > 768);

  return (
    <Modal
      visible={visible}
      animationType={isDesktop ? 'fade' : 'slide'}
      presentationStyle={isDesktop ? 'overFullScreen' : 'pageSheet'}
      onRequestClose={onClose}
      transparent={isDesktop}
    >
      {isDesktop ? (
        <View style={styles.desktopModalOverlay}>
          <View style={styles.desktopModalContainer}>
            {/* Header */}
            <View style={styles.header}>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <MaterialIcons name="close" size={24} color={Colors.light.text} />
              </TouchableOpacity>
              <ThemedText style={styles.headerTitle}>Select Location</ThemedText>
              <View style={styles.placeholder} />
            </View>

            {/* Tabs */}
            <View style={styles.tabs}>
              <TouchableOpacity
                style={[styles.tab, activeTab === 'current' && styles.activeTab]}
                onPress={() => setActiveTab('current')}
              >
                <MaterialIcons
                  name="my-location"
                  size={16}
                  color={activeTab === 'current' ? Colors.light.primary : Colors.light.textSecondary}
                />
                <ThemedText style={[styles.tabText, activeTab === 'current' && styles.activeTabText]}>
                  Current
                </ThemedText>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.tab, activeTab === 'search' && styles.activeTab]}
                onPress={() => setActiveTab('search')}
              >
                <MaterialIcons
                  name="search"
                  size={16}
                  color={activeTab === 'search' ? Colors.light.primary : Colors.light.textSecondary}
                />
                <ThemedText style={[styles.tabText, activeTab === 'search' && styles.activeTabText]}>
                  Search
                </ThemedText>
              </TouchableOpacity>
            </View>

            {/* Content */}
            <ScrollView style={styles.desktopContent} showsVerticalScrollIndicator={false}>
              {activeTab === 'current' && renderCurrentLocationTab()}
              {activeTab === 'search' && renderSearchTab()}
            </ScrollView>
          </View>
        </View>
      ) : (
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

            {/* Tabs */}
            <View style={styles.tabs}>
              <TouchableOpacity
                style={[styles.tab, activeTab === 'current' && styles.activeTab]}
                onPress={() => setActiveTab('current')}
              >
                <MaterialIcons
                  name="my-location"
                  size={16}
                  color={activeTab === 'current' ? Colors.light.primary : Colors.light.textSecondary}
                />
                <ThemedText style={[styles.tabText, activeTab === 'current' && styles.activeTabText]}>
                  Current
                </ThemedText>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.tab, activeTab === 'search' && styles.activeTab]}
                onPress={() => setActiveTab('search')}
              >
                <MaterialIcons
                  name="search"
                  size={16}
                  color={activeTab === 'search' ? Colors.light.primary : Colors.light.textSecondary}
                />
                <ThemedText style={[styles.tabText, activeTab === 'search' && styles.activeTabText]}>
                  Search
                </ThemedText>
              </TouchableOpacity>
            </View>

            {/* Content */}
            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
              {activeTab === 'current' && renderCurrentLocationTab()}
              {activeTab === 'search' && renderSearchTab()}
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      )}
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
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    marginHorizontal: 4,
    borderRadius: 8,
    gap: 6,
  },
  activeTab: {
    backgroundColor: Colors.light.primaryLight,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.light.textSecondary,
  },
  activeTabText: {
    color: Colors.light.primary,
  },
  content: {
    flex: 1,
  },
  desktopContent: {
    flex: 1,
  },
  tabContent: {
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
  divider: {
    height: 1,
    backgroundColor: Colors.light.border,
    marginHorizontal: 20,
    marginVertical: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginHorizontal: 20,
    marginBottom: 12,
  },
  listContainer: {
    paddingHorizontal: 20,
  },
  locationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginVertical: 2,
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
    fontSize: 13,
    color: Colors.light.textSecondary,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 20,
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
    outlineStyle: 'none',
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
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  noRecentSubtext: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    textAlign: 'center',
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
  refreshButton: {
    padding: 8,
    borderRadius: 16,
    backgroundColor: Colors.light.backgroundSecondary,
  },
  desktopKeyboardContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  desktopHeader: {
    marginHorizontal: 'auto',
    maxWidth: 600,
    width: '100%',
  },
  desktopModalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  desktopModalContainer: {
    width: '90%',
    maxWidth: 600,
    height: Dimensions.get('window').height * 0.8,
    borderRadius: 16,
    margin: 'auto',
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