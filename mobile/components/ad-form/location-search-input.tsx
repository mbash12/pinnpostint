/**
 * Location Search Input Component
 * Search and select location using Google Maps API
 * Displays selected location with option to open map picker
 */

'use client';

import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Modal } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

import { Colors } from '@/constants/theme';
import { ThemedText } from '@/components/themed-text';
import { LocationSuggestion, AdLocation } from '@/types/location.types';
import { locationService } from '@/services/location.service';
import { googleMapsService } from '@/services/google-maps.service';
import config from '@/config/environment';
import { GoogleLocationPicker } from '@/components/ui/google-location-picker';

interface LocationSearchInputProps {
  value?: AdLocation;
  onChange: (location: AdLocation) => void;
  placeholder?: string;
  required?: boolean;
  error?: string;
}

export function LocationSearchInput({
  value,
  onChange,
  placeholder = 'Search for location...',
  required = false,
  error,
}: LocationSearchInputProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<LocationSuggestion[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showMapPicker, setShowMapPicker] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Clear timeout on unmount
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const handleSearch = (query: string) => {
    setSearchQuery(query);

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    if (!query.trim() || query.length < 2) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }

    setIsSearching(true);
    setShowDropdown(true);

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

  const handleSelectLocation = async (location: LocationSuggestion) => {
    // If location has placeId but no coordinates, fetch place details
    let enrichedLocation = location;
    if (location.placeId && (location.latitude === 0 || location.longitude === 0)) {
      setIsSearching(true);
      try {
        const details = await googleMapsService.getPlaceDetails(location.placeId.replace('google_', ''));
        if (details) {
          enrichedLocation = details;
        }
      } catch (err) {
        console.error('Error fetching place details:', err);
      } finally {
        setIsSearching(false);
      }
    }

    const adLocation: AdLocation = {
      latitude: enrichedLocation.latitude,
      longitude: enrichedLocation.longitude,
      address: enrichedLocation.address,
      displayName: enrichedLocation.displayName,
    };

    onChange(adLocation);
    setSearchQuery(enrichedLocation.displayName);
    setShowDropdown(false);
    setSearchResults([]);
  };

  const handleClearSelection = () => {
    onChange({} as AdLocation);
    setSearchQuery('');
    setSearchResults([]);
  };

  const handleMapLocationSelect = (location: {
    latitude: number;
    longitude: number;
    address: any;
    displayName: string;
  }) => {
    const adLocation: AdLocation = {
      latitude: location.latitude,
      longitude: location.longitude,
      address: location.address,
      displayName: location.displayName,
    };

    onChange(adLocation);
    setSearchQuery(location.displayName);
    setShowMapPicker(false);
  };

  return (
    <View style={styles.container}>
      {/* Input with map picker button */}
      <View style={[styles.inputContainer, error && styles.inputError]}>
        <MaterialIcons name="search" size={20} color={Colors.light.textSecondary} />
        <TextInput
          ref={inputRef}
          style={styles.input}
          placeholder={placeholder}
          placeholderTextColor={Colors.light.textSecondary}
          value={searchQuery}
          onChangeText={handleSearch}
          tabIndex={0}
          onFocus={() => {
            if (searchResults.length > 0) {
              setShowDropdown(true);
            }
          }}
        />
        {isSearching ? (
          <ActivityIndicator size="small" color={Colors.light.primary} />
        ) : value?.displayName ? (
          <TouchableOpacity onPress={handleClearSelection} hitSlop={8}>
            <MaterialIcons name="clear" size={20} color={Colors.light.textSecondary} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={() => setShowMapPicker(true)}
            hitSlop={8}
            style={styles.mapButton}
          >
            <MaterialIcons name="map" size={20} color={Colors.light.primary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Search Results Dropdown */}
      {showDropdown && searchResults.length > 0 && (
        <View style={styles.dropdown}>
          {searchResults.map((location) => (
            <TouchableOpacity
              key={location.id}
              style={styles.dropdownItem}
              onPress={() => handleSelectLocation(location)}
            >
              <MaterialIcons name="location-on" size={20} color={Colors.light.primary} />
              <View style={styles.dropdownItemContent}>
                <Text style={styles.dropdownItemName}>{location.name}</Text>
                <Text style={styles.dropdownItemAddress} numberOfLines={2}>
                  {location.displayName}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Selected Location Display */}
      {value?.displayName && !showDropdown && (
        <View style={styles.selectedLocation}>
          <MaterialIcons name="location-on" size={16} color={Colors.light.primary} />
          <Text style={styles.selectedLocationText} numberOfLines={2}>
            {value.displayName}
          </Text>
          <TouchableOpacity onPress={() => setShowMapPicker(true)} style={styles.changeButton}>
            <MaterialIcons name="edit" size={16} color={Colors.light.primary} />
          </TouchableOpacity>
        </View>
      )}

      {/* Error Message */}
      {error && (
        <Text style={styles.errorText}>{error}</Text>
      )}

      {/* Map Picker Modal */}
      <Modal
        visible={showMapPicker}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowMapPicker(false)}
      >
        <View style={styles.mapModal}>
          <View style={styles.mapModalHeader}>
            <TouchableOpacity onPress={() => setShowMapPicker(false)} style={styles.closeButton}>
              <MaterialIcons name="close" size={24} color={Colors.light.text} />
            </TouchableOpacity>
            <Text style={styles.mapModalTitle}>Select Location on Map</Text>
            <View style={styles.placeholder} />
          </View>
          <View style={styles.mapModalContent}>
            <GoogleLocationPicker
              onLocationSelect={handleMapLocationSelect}
              initialLocation={value ? { latitude: value.latitude, longitude: value.longitude } : undefined}
              height={500}
              showSearch={true}
            />
          </View>
          <TouchableOpacity
            style={styles.doneButton}
            onPress={() => setShowMapPicker(false)}
          >
            <Text style={styles.doneButtonText}>Done</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}

const styles = {
  container: {
    gap: 8,
  } as const,
  inputContainer: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.light.background,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.light.border,
    gap: 8,
  },
  inputError: {
    borderColor: '#ef4444',
  },
  input: {
    flex: 1,
    fontSize: 16,
    padding: 0,
    borderWidth: 0,
    outlineWidth: 0,
    outlineColor: 'transparent',
    outlineStyle: 'none',
    color: Colors.light.text,
  },
  mapButton: {
    padding: 4,
  },
  dropdown: {
    backgroundColor: Colors.light.background,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.light.border,
    marginTop: 4,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  } as any,
  dropdownItem: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  dropdownItemContent: {
    flex: 1,
  } as const,
  dropdownItemName: {
    fontSize: 15,
    fontWeight: '500',
    color: Colors.light.text,
    marginBottom: 2,
  },
  dropdownItemAddress: {
    fontSize: 13,
    color: Colors.light.textSecondary,
  },
  selectedLocation: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: Colors.light.primaryLight,
    borderRadius: 8,
    gap: 8,
  },
  selectedLocationText: {
    flex: 1,
    fontSize: 14,
    color: Colors.light.text,
  },
  changeButton: {
    padding: 4,
  },
  errorText: {
    fontSize: 13,
    color: '#ef4444',
    marginLeft: 16,
  },
  mapModal: {
    flex: 1,
    backgroundColor: Colors.light.background,
  } as const,
  mapModalHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  closeButton: {
    padding: 4,
  },
  mapModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.light.text,
  },
  placeholder: {
    width: 32,
  },
  mapModalContent: {
    flex: 1,
  } as const,
  doneButton: {
    alignItems: 'center' as const,
    paddingVertical: 16,
    backgroundColor: Colors.light.primary,
  },
  doneButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
};
