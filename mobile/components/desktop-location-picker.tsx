import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  ScrollView,
  Platform,
  ViewStyle,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors } from '@/constants/theme';
import { locationService } from '@/services/location.service';
import { recentLocationsService } from '@/services/recent-locations.service';
import { geolocationService } from '@/services/geolocation.service';
import { LocationSuggestion, RecentLocation } from '@/types/location.types';
import { useCurrentLocation } from '@/hooks/use-current-location';
import { googleMapsService } from '@/services/google-maps.service';
import config from '@/config/environment';

interface DesktopLocationPickerProps {
  currentLocation: LocationSuggestion;
  onLocationSelect: (location: LocationSuggestion) => void;
  onSelectPreciseManually?: () => void;
  variant?: 'header' | 'filter';
  containerStyle?: ViewStyle;
  placeholder?: string;
}

export function DesktopLocationPicker({
  currentLocation,
  onLocationSelect,
  onSelectPreciseManually,
  variant = 'header',
  containerStyle,
  placeholder = "Select location"
}: DesktopLocationPickerProps) {
  const [searchQuery, setSearchQuery] = useState(currentLocation.name === 'Select location' ? '' : currentLocation.name);
  const [isDirty, setIsDirty] = useState(false);
  const [searchResults, setSearchResults] = useState<LocationSuggestion[]>([]);
  const [recentLocations, setRecentLocations] = useState<RecentLocation[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isDropdownVisible, setIsDropdownVisible] = useState(false);
  const [isSelecting, setIsSelecting] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isHeader = variant === 'header';

  useEffect(() => {
    setSearchQuery(currentLocation.name === 'Select location' ? '' : currentLocation.name);
    setIsDirty(false);
  }, [currentLocation.name]);

  useEffect(() => {
    loadRecentLocations();
  }, []);

  const loadRecentLocations = async () => {
    try {
      const locations = await recentLocationsService.getLocalRecentLocations();
      setRecentLocations(locations.slice(0, 5));
    } catch (error) {
    }
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    setIsDirty(true);
    setIsDropdownVisible(true);

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    if (!query.trim() || query.length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    timeoutRef.current = setTimeout(async () => {
      try {
        const results = await locationService.searchLocations(query, 5);
        setSearchResults(results);
      } catch (err) {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);
  };

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

      await recentLocationsService.saveLocation({
        name: enrichedLocation.name,
        country: enrichedLocation.address.country,
        state: enrichedLocation.address.state || '',
        city: enrichedLocation.address.city,
        latitude: enrichedLocation.latitude,
        longitude: enrichedLocation.longitude,
      });

      setSearchQuery(enrichedLocation.name);
      onLocationSelect(enrichedLocation);
      setIsDropdownVisible(false);
      setIsDirty(false);
    } catch (error) {
    } finally {
      setIsSelecting(false);
    }
  };

  const handleRecentLocationSelect = async (recent: RecentLocation) => {
    const location: LocationSuggestion = {
      id: recent.id,
      name: recent.name,
      displayName: recent.address || recent.name,
      latitude: recent.latitude || 0,
      longitude: recent.longitude || 0,
      address: {
        city: recent.city,
        state: recent.state,
        country: recent.country,
        postalCode: recent.postalCode,
        formatted: recent.address || recent.name,
      },
    };
    handleLocationSelect(location);
  };

  const handleCurrentLocationSelect = async () => {
    setIsSelecting(true);
    try {
      const hasPermission = await geolocationService.requestLocationPermission();
      if (!hasPermission) {
        setIsSelecting(false);
        return;
      }

      const freshLocation = await geolocationService.getGeolocation(true);
      if (freshLocation) {
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

        handleLocationSelect(locationData);
      }
    } catch (error) {
    } finally {
      setIsSelecting(false);
    }
  };

  return (
    <View style={[styles.container, containerStyle]}>
      <View style={styles.inputWrapper}>
        <View style={[
          styles.locationInputContainer,
          isHeader ? styles.headerInputContainer : styles.filterInputContainer
        ]}>
          <MaterialIcons
            name="location-on"
            size={18}
            color={isHeader || searchQuery ? Colors.light.primary : Colors.light.textSecondary}
            style={styles.inputIcon}
          />
          <TextInput
            style={[styles.input, !isHeader && styles.filterInput]}
            placeholder={placeholder}
            value={searchQuery}
            onChangeText={handleSearch}
            onFocus={() => {
              setIsDropdownVisible(true);
              loadRecentLocations();
            }}
            onBlur={() => {
              setTimeout(() => setIsDropdownVisible(false), 200);
            }}
          />
          <View style={styles.trailingIconContainer}>
            {isSearching || isSelecting ? (
              <ActivityIndicator size="small" color={Colors.light.primary} />
            ) : (
              <View style={styles.trailingIcons}>
                {variant === 'filter' && searchQuery.length > 0 && (
                  <TouchableOpacity
                    onPress={(e) => {
                      e.stopPropagation();
                      setSearchQuery('');
                      onLocationSelect({
                        id: 'not-set',
                        name: 'Select location',
                        displayName: 'Select location',
                        latitude: 0,
                        longitude: 0,
                        address: { country: '', formatted: 'Select location' }
                      });
                    }}
                    style={styles.clearButton}
                  >
                    <MaterialIcons name="clear" size={18} color={Colors.light.textSecondary} />
                  </TouchableOpacity>
                )}
                {variant !== 'filter' && (
                  <MaterialIcons
                    name="expand-more"
                    size={20}
                    color={Colors.light.textSecondary}
                    style={!isHeader && styles.chevronMargin}
                  />
                )}
              </View>
            )}
          </View>
        </View>

        {isDropdownVisible && (
          <View style={[styles.dropdown, !isHeader && styles.filterDropdown]}>
            <ScrollView style={styles.dropdownScroll} keyboardShouldPersistTaps="handled">
              <TouchableOpacity
                style={styles.dropdownItem}
                onPress={handleCurrentLocationSelect}
              >
                <View style={styles.itemIconContainer}>
                  <MaterialIcons name="my-location" size={18} color={Colors.light.primary} />
                </View>
                <View style={styles.itemTextContainer}>
                  <Text style={styles.itemTitle}>Use Current Location</Text>
                </View>
              </TouchableOpacity>

              {onSelectPreciseManually && (
                <TouchableOpacity
                  style={styles.dropdownItem}
                  onPress={() => {
                    setIsDropdownVisible(false);
                    onSelectPreciseManually();
                  }}
                >
                  <View style={styles.itemIconContainer}>
                    <MaterialIcons name="map" size={18} color={Colors.light.primary} />
                  </View>
                  <View style={styles.itemTextContainer}>
                    <Text style={styles.itemTitle}>Select from map</Text>
                  </View>
                </TouchableOpacity>
              )}

              {isDirty && searchQuery.length > 0 && searchResults.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Search Results</Text>
                  {searchResults.map((location) => (
                    <TouchableOpacity
                      key={location.id}
                      style={styles.dropdownItem}
                      onPress={() => handleLocationSelect(location)}
                    >
                      <View style={styles.itemIconContainer}>
                        <MaterialIcons name="location-on" size={18} color={Colors.light.primary} />
                      </View>
                      <View style={styles.itemTextContainer}>
                        <Text style={styles.itemTitle} numberOfLines={1}>{location.name}</Text>
                        <Text style={styles.itemSubtitle} numberOfLines={1}>{location.displayName}</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {(!isDirty || !searchQuery.trim()) && recentLocations.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Recent Locations</Text>
                  {recentLocations.map((recent) => (
                    <TouchableOpacity
                      key={recent.id}
                      style={styles.dropdownItem}
                      onPress={() => handleRecentLocationSelect(recent)}
                    >
                      <View style={styles.itemIconContainer}>
                        <MaterialIcons name="history" size={18} color={Colors.light.textSecondary} />
                      </View>
                      <View style={styles.itemTextContainer}>
                        <Text style={styles.itemTitle} numberOfLines={1}>{recent.name}</Text>
                        <Text style={styles.itemSubtitle} numberOfLines={1}>
                          {[recent.city, recent.state].filter(Boolean).join(', ')}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {isDirty && searchQuery.length > 0 && !isSearching && searchResults.length === 0 && (
                <View style={styles.noResults}>
                  <Text style={styles.noResultsText}>No results found</Text>
                </View>
              )}
            </ScrollView>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    zIndex: 1000,
    width: '100%',
  },
  inputWrapper: {
    position: 'relative',
  },
  locationInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 12,
    paddingRight: 4,
    overflow: 'hidden',
  },
  headerInputContainer: {
    backgroundColor: Colors.light.backgroundSecondary,
    borderRadius: 20,
    height: 40,
  },
  filterInputContainer: {
    backgroundColor: '#FAFAFA',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E8E8E8',
    height: 44,
  },
  inputIcon: {
    marginRight: 8,
  },
  trailingIconContainer: {
    minWidth: 24,
    alignItems: 'center',
    justifyContent: 'center',
    paddingRight: 4,
  },
  trailingIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  clearButton: {
    padding: 2,
    borderRadius: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  chevronMargin: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    minWidth: 0,
    fontSize: 13,
    color: Colors.light.text,
    paddingVertical: 8,
    backgroundColor: 'transparent',
    borderWidth: 0,
    ...Platform.select({
      web: {
        outlineStyle: 'none',
        boxShadow: 'none',
      },
    }),
  } as any,
  filterInput: {
    fontSize: 14,
    fontWeight: '500',
  },
  dropdown: {
    position: 'absolute',
    top: 45,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
    maxHeight: 300,
    zIndex: 2000,
    ...Platform.select({
      web: {
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
      },
      default: {
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 10,
      },
    }),
  },
  filterDropdown: {
    top: 48,
    borderRadius: 8,
  },
  dropdownScroll: {
    paddingVertical: 4,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  itemIconContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.light.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  itemTextContainer: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.light.text,
  },
  itemSubtitle: {
    fontSize: 11,
    color: Colors.light.textSecondary,
    marginTop: 1,
  },
  section: {
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.light.textSecondary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  noResults: {
    padding: 16,
    alignItems: 'center',
  },
  noResultsText: {
    fontSize: 13,
    color: Colors.light.textSecondary,
  },
});
