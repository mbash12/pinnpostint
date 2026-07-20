import { useState, useMemo, useEffect } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

import { Colors } from '@/constants/theme';
import { ThemedText } from '@/components/themed-text';
import { BaseBottomSheet } from '@/components/ui/base-bottom-sheet';
import { locationsService } from '@/services/locations.service';
import { geolocationService } from '@/services/geolocation.service';
import { recentLocationsService } from '@/services/recent-locations.service';



// No dummy fallbacks

export type Location = {
  id: string;
  name: string;
  state?: {
    id: string;
    name: string;
  } | string;
  city?: {
    id: string;
    name: string;
  } | string;
  country: string;
};

export type LocationSelectModalProps = {
  visible: boolean;
  onClose: () => void;
  onLocationSelect: (location: Location) => void;
  currentLocation?: Location;
  onUseCurrentLocation?: () => Promise<void>;
  onSelectPreciseManually?: () => void;
  locationLoading?: boolean;
};

export function LocationSelectModal({
  visible,
  onClose,
  onLocationSelect,
  currentLocation,
  onUseCurrentLocation,
  onSelectPreciseManually,
  locationLoading = false,
}: LocationSelectModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTab, setSelectedTab] = useState<'current' | 'search'>('current');
  const [isLoading, setIsLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<Location[]>([]);
  const [popularCities, setPopularCities] = useState<Location[]>([]);

  const fetchPopularCities = async () => {
    try {
      const resp = await locationsService.getLocations({ limit: 10 });
      if ((resp as any).success && (resp as any).data) {
        const list = ((resp as any).data || []).map((loc: any) => ({
          id: loc.id,
          name: loc.name,
          state: typeof loc.state === 'object' ? loc.state.name : loc.state,
          city: typeof loc.city === 'object' ? loc.city.name : loc.city,
          country: loc.country,
        })) as Location[];
        setPopularCities(list);
      }
    } catch (e) {
      // ignore, keep fallback
    }
  };

  useEffect(() => {
    if (visible) {
      fetchPopularCities();
    }
  }, [visible]);

  useEffect(() => {
    const runSearch = async () => {
      if (!searchQuery.trim()) {
        setSearchResults([]);
        return;
      }
      try {
        setIsLoading(true);
        const resp = await locationsService.getLocations({ search: searchQuery, limit: 10 });
        if ((resp as any).success && (resp as any).data) {
          const list = ((resp as any).data || []).map((loc: any) => ({
            id: loc.id,
            name: loc.name,
            state: typeof loc.state === 'object' ? loc.state.name : loc.state,
            city: typeof loc.city === 'object' ? loc.city.name : loc.city,
            country: loc.country,
          })) as Location[];
          setSearchResults(list);
        } else {
          setSearchResults([]);
        }
      } catch (e) {
        setSearchResults([]);
      } finally {
        setIsLoading(false);
      }
    };
    runSearch();
  }, [searchQuery]);

  const handleLocationSelect = (location: Location) => {
    setIsLoading(true);
    setTimeout(() => {
      recentLocationsService.saveLocation({
        name: location.name,
        country: location.country,
        state: typeof location.state === 'object' ? location.state.name : location.state,
      });
      onLocationSelect({
        ...location,
        state: typeof location.state === 'object' ? location.state.name : location.state,
        city: typeof location.city === 'object' ? location.city.name : location.city,
      });
      setIsLoading(false);
      onClose();
      setSearchQuery('');
    }, 500);
  };

  const renderLocationItem = ({ item }: { item: Location }) => (
    <TouchableOpacity
      style={styles.locationItem}
      onPress={() => handleLocationSelect(item)}
      disabled={isLoading}
    >
      <View style={styles.locationIconContainer}>
        <MaterialIcons name="location-on" size={20} color={Colors.light.primary} />
      </View>
      <View style={styles.locationInfo}>
        <ThemedText style={styles.locationName}>{item.name}</ThemedText>
        <ThemedText style={styles.locationDetails}>
          {typeof item.city === 'string' && item.city ? `${item.city}, ` : ''}{typeof item.state === 'string' ? item.state : ''}, {item.country}
        </ThemedText>
      </View>
      {currentLocation?.id === item.id && (
        <MaterialIcons name="check" size={20} color={Colors.light.primary} />
      )}
    </TouchableOpacity>
  );

  const renderContent = () => {
    switch (selectedTab) {
      case 'current':
        return (
          <View style={styles.tabContent}>
            <TouchableOpacity
              style={styles.currentLocationButton}
              onPress={async () => {
                if (onUseCurrentLocation) {
                  setIsLoading(true);
                  await onUseCurrentLocation();
                  setIsLoading(false);
                  if (currentLocation && currentLocation.id === 'current') {
                    handleLocationSelect(currentLocation);
                  }
                } else {
                  // Pass true to force update when user manually clicks "Use current location"
                  const geo = await geolocationService.getGeolocation(true);
                  const currentLoc = geo ? {
                    id: 'current',
                    name: geo.address.formatted || 'Current Location',
                    state: geo.address.state || '',
                    country: geo.address.country || '',
                  } : (currentLocation || { id: 'current', name: 'Current Location', state: '', country: '' });
                  handleLocationSelect(currentLoc);
                }
              }}
              disabled={isLoading || locationLoading}
            >
              <View style={styles.currentLocationIcon}>
                <MaterialIcons name="my-location" size={24} color={Colors.light.primary} />
              </View>
              <View style={styles.currentLocationText}>
                <ThemedText style={styles.currentLocationTitle}>Use current location</ThemedText>
                <ThemedText style={styles.currentLocationSubtitle}>
                  {currentLocation?.name || 'Detecting current location'}
                </ThemedText>
              </View>
              {(isLoading || locationLoading) && <ActivityIndicator size="small" color={Colors.light.primary} />}
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.preciseLocationButton}
              onPress={onSelectPreciseManually}
            >
              <MaterialIcons name="map" size={18} color={Colors.light.primary} />
              <ThemedText style={styles.manualLocationText}>Select from map</ThemedText>
            </TouchableOpacity>

            <View style={styles.divider} />

            <ThemedText style={styles.sectionTitle}>Popular Cities</ThemedText>
            <FlatList
              data={popularCities}
              renderItem={renderLocationItem}
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.listContainer}
            />
          </View>
        );

      case 'search':
        return (
          <View style={styles.tabContent}>
            <View style={styles.searchInputContainer}>
              <MaterialIcons name="search" size={20} color={Colors.light.textSecondary} style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search for a location..."
                placeholderTextColor={Colors.light.textSecondary}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoFocus
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <MaterialIcons name="clear" size={20} color={Colors.light.textSecondary} />
                </TouchableOpacity>
              )}
            </View>

            {searchResults.length > 0 ? (
              <FlatList
                data={searchResults}
                renderItem={renderLocationItem}
                keyExtractor={(item) => item.id}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.listContainer}
              />
            ) : searchQuery.length > 0 ? (
              <View style={styles.noResults}>
                <MaterialIcons name="location-off" size={48} color={Colors.light.textSecondary} />
                <ThemedText style={styles.noResultsText}>No locations found</ThemedText>
                <ThemedText style={styles.noResultsSubtext}>
                  Try searching with different keywords
                </ThemedText>
              </View>
            ) : (
              <>
                <ThemedText style={styles.sectionTitle}>Popular Cities</ThemedText>
                <FlatList
                  data={popularCities}
                  renderItem={renderLocationItem}
                  keyExtractor={(item) => item.id}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.listContainer}
                />
              </>
            )}
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <BaseBottomSheet
      visible={visible}
      onClose={onClose}
      title="Select Location"
      backdropOpacity={0.3}
      maxHeight={400}
    >
      <View style={styles.fixedContentContainer}>
        <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tab, selectedTab === 'current' && styles.activeTab]}
            onPress={() => setSelectedTab('current')}
          >
            <MaterialIcons
              name="my-location"
              size={16}
              color={selectedTab === 'current' ? Colors.light.primary : Colors.light.textSecondary}
            />
            <ThemedText
              style={[styles.tabText, selectedTab === 'current' && styles.activeTabText]}
            >
              Current
            </ThemedText>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tab, selectedTab === 'search' && styles.activeTab]}
            onPress={() => setSelectedTab('search')}
          >
            <MaterialIcons
              name="search"
              size={16}
              color={selectedTab === 'search' ? Colors.light.primary : Colors.light.textSecondary}
            />
            <ThemedText
              style={[styles.tabText, selectedTab === 'search' && styles.activeTabText]}
            >
              Search
            </ThemedText>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.contentScroll} showsVerticalScrollIndicator={false}>
          {renderContent()}
        </ScrollView>
      </View>
    </BaseBottomSheet>
  );
}

const styles = StyleSheet.create({
  fixedContentContainer: {
    flex: 1,
    height: 320,
  },
  contentScroll: {
    flex: 1,
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
  tabContent: {
    flex: 1,
  },
  currentLocationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    marginHorizontal: 16,
    marginTop: 16,
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
    marginVertical: 20,
    marginHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginHorizontal: 16,
    marginBottom: 12,
  },
  listContainer: {
    paddingHorizontal: 16,
  },
  locationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginVertical: 2,
  },
  locationIconContainer: {
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
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginVertical: 16,
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
  noResults: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
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
  preciseLocationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 16,
    padding: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.light.primary,
    gap: 8,
    marginTop: 8,
  },
  manualLocationText: {
    fontSize: 14,
    color: Colors.light.primary,
    fontWeight: '500',
  },
});
