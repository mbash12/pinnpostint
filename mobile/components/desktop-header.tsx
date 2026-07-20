import { MaterialIcons } from '@expo/vector-icons';
import { useRouter, usePathname, useLocalSearchParams } from 'expo-router';
import { useState, useEffect, useMemo, useRef } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { NetworkImage } from '@/components/ui/network-image';

import { DesktopLocationPicker } from '@/components/desktop-location-picker';
import { UnifiedLocationPicker } from '@/components/ui/unified-location-picker';
import { LocationSuggestion } from '@/types/location.types';
import { Colors, Shadows, Fonts } from '@/constants/theme';
import { useCurrentLocation } from '@/hooks/use-current-location';
import { useSelectedLocation, type SelectedLocation } from '@/contexts/location-context';
import { useFilter } from '@/hooks/use-filter';
import { useAuth } from '@/contexts/auth-context';
import { useUnreadChatCount } from '@/hooks/use-unread-chat-count';

interface DesktopHeaderProps {
  onLocationChange?: (location: LocationSuggestion) => void;
  onMenuPress?: () => void;
  hideSearch?: boolean;
}

export function DesktopHeader({ onLocationChange, onMenuPress, hideSearch = false }: DesktopHeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useLocalSearchParams();
  const { showFilter, setShowFilter } = useFilter();
  const { user, isAuthenticated } = useAuth();
  const { unreadCount } = useUnreadChatCount();
  const { selectedLocation, setSelectedLocation } = useSelectedLocation();
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [locationPickerVisible, setLocationPickerVisible] = useState(false);
  const [showPreciseOnly, setShowPreciseOnly] = useState(false);
  const { location: geolocation, isLoading: locationLoading, fetchLocation, permissionGranted } = useCurrentLocation();

  // Memoize the current location to prevent unnecessary re-renders
  const currentLocation: LocationSuggestion = useMemo(() => {
    // If user has manually selected a location (and it's not just GPS auto-location), convert to LocationSuggestion format
    if (selectedLocation && selectedLocation.id !== 'current') {
      return {
        id: selectedLocation.id,
        name: selectedLocation.name,
        displayName: selectedLocation.address?.formatted || `${selectedLocation.name}, ${selectedLocation.state || ''}`,
        latitude: 0,
        longitude: 0,
        address: {
          city: selectedLocation.city || '',
          state: selectedLocation.state || '',
          country: selectedLocation.country,
          postalCode: '',
          formatted: `${selectedLocation.name}, ${selectedLocation.state || ''}, ${selectedLocation.country}`,
        },
      };
    }

    // If we have GPS location, use it
    if (geolocation) {
      const { address } = geolocation;
      const locationName = address.name || [address.city, address.state].filter(Boolean).join(', ') || 'Current Location';
      return {
        id: 'current',
        name: locationName,
        displayName: address.formatted || locationName,
        latitude: geolocation.coordinates.latitude,
        longitude: geolocation.coordinates.longitude,
        address: {
          city: address.city,
          state: address.state,
          country: address.country || '',
          postalCode: address.postalCode,
          formatted: address.formatted || locationName,
        },
      };
    }

    // While loading or if permission denied, show placeholder
    return {
      id: 'not-set',
      name: 'Select location',
      displayName: 'Select location',
      latitude: 0,
      longitude: 0,
      address: {
        country: '',
        formatted: 'Select location',
      },
    };
  }, [geolocation, selectedLocation, locationLoading]);

  const handleLocationSelect = (location: LocationSuggestion) => {
    // Convert LocationSuggestion to SelectedLocation format
    const selectedLoc: SelectedLocation = {
      id: location.id,
      name: location.name,
      city: location.address.city,
      state: location.address.state || '',
      country: location.address.country,
      latitude: location.latitude,
      longitude: location.longitude,
      address: {
        road: location.address.road || '',
        house_number: location.address.house_number || '',
        city: location.address.city || '',
        state: location.address.state || '',
        country: location.address.country,
        postalCode: location.address.postalCode || '',
        formatted: location.address.formatted || `${location.name}, ${location.address.state || ''}`,
      },
    };

    setSelectedLocation(selectedLoc);
    onLocationChange?.(location);
  };

  const handleSearch = () => {
    // Build params object preserving existing filters
    const filterParams: any = {};
    
    // On web, read from the actual URL to get the current page's params
    // This is necessary because useLocalSearchParams in the layout doesn't
    // have access to child route params (like /browse's params)
    if (typeof window !== 'undefined' && window.location) {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('minPrice')) filterParams.minPrice = urlParams.get('minPrice');
      if (urlParams.get('maxPrice')) filterParams.maxPrice = urlParams.get('maxPrice');
      if (urlParams.get('locationLatitude')) filterParams.locationLatitude = urlParams.get('locationLatitude');
      if (urlParams.get('locationLongitude')) filterParams.locationLongitude = urlParams.get('locationLongitude');
      if (urlParams.get('locationName')) filterParams.locationName = urlParams.get('locationName');
      if (urlParams.get('sortBy')) filterParams.sortBy = urlParams.get('sortBy');
      if (urlParams.get('categoryId')) filterParams.categoryId = urlParams.get('categoryId');
      if (urlParams.get('category')) filterParams.category = urlParams.get('category');
      if (urlParams.get('subcategoryId')) filterParams.subcategoryId = urlParams.get('subcategoryId');
      if (urlParams.get('subcategoryName')) filterParams.subcategoryName = urlParams.get('subcategoryName');
    } else {
      // Fallback for non-web: use params from useLocalSearchParams
      if (params.minPrice) filterParams.minPrice = params.minPrice;
      if (params.maxPrice) filterParams.maxPrice = params.maxPrice;
      if (params.locationLatitude) filterParams.locationLatitude = params.locationLatitude;
      if (params.locationLongitude) filterParams.locationLongitude = params.locationLongitude;
      if (params.locationName) filterParams.locationName = params.locationName;
      if (params.sortBy) filterParams.sortBy = params.sortBy;
      if (params.categoryId) filterParams.categoryId = params.categoryId;
      if (params.category) filterParams.category = params.category;
      if (params.subcategoryId) filterParams.subcategoryId = params.subcategoryId;
      if (params.subcategoryName) filterParams.subcategoryName = params.subcategoryName;
    }

    if (searchQuery.trim()) {
      filterParams.search = searchQuery.trim();
    }

    // Navigate to browse with search query and preserved filters
    router.push({ pathname: '/(tabs)/browse', params: filterParams } as any);
  };

  // Clear search input when navigating away from browse page
  useEffect(() => {
    if (!pathname?.includes('/browse')) {
      setSearchQuery('');
    }
  }, [pathname]);

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <View style={styles.navContent}>
          {/* Logo and Menu */}
          <View style={styles.logoSection}>
            <TouchableOpacity
              style={styles.menuButton}
              onPress={onMenuPress}
            >
              <MaterialIcons name="menu" size={24} color={Colors.light.text} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.logoContainer}
              onPress={() => router.push('/' as any)}
            >
              <View style={styles.logoWrapper}>
                <Image source={require('@/assets/images/logo.png')} style={styles.logo} resizeMode="contain" />
                <View style={styles.textColumn}>
                  <Text style={styles.brandName}>Pin N Post</Text>
                  <Text style={styles.tagline}>BUY, RENT, SELL</Text>
                </View>
              </View>
            </TouchableOpacity>
          </View>

          {/* Search Bar */}
          {!hideSearch && (
            <View style={styles.searchSection}>
              <View style={[styles.searchContainer, isSearchFocused && styles.searchContainerFocused]}>
                <TextInput
                  style={[styles.searchInput, isSearchFocused && styles.searchInputFocused]}
                  placeholder="Search for items, services, jobs..."
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  onSubmitEditing={handleSearch}
                  placeholderTextColor={Colors.light.textSecondary}
                  selectionColor={Colors.light.primary}
                  cursorColor={Colors.light.primary}
                  underlineColorAndroid="transparent"
                  tabIndex={0}
                  onFocus={() => setIsSearchFocused(true)}
                  onBlur={() => setIsSearchFocused(false)}
                />
                <TouchableOpacity style={styles.searchButton} onPress={handleSearch}>
                  <MaterialIcons name="search" size={20} color={Colors.light.textSecondary} />
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                style={styles.filterButton}
                onPress={() => {
                  setShowFilter(true);
                }}
                activeOpacity={0.7}
              >
                <MaterialIcons name="filter-list" size={20} color={Colors.light.primary} />
              </TouchableOpacity>
            </View>
          )}

          {/* Right Actions */}
          <View style={styles.rightActions}>
            {/* Location */}
            <DesktopLocationPicker
              currentLocation={currentLocation}
              onLocationSelect={handleLocationSelect}
              onSelectPreciseManually={() => {
                setShowPreciseOnly(true);
                setLocationPickerVisible(true);
              }}
              containerStyle={styles.headerLocationPicker}
            />

            {/* Chat - Only show when authenticated */}
            {isAuthenticated && (
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => router.push('/(pages)/chat')}
              >
                <View style={styles.chatIconWrap}>
                  <MaterialIcons name="chat-bubble-outline" size={22} color={Colors.light.text} />
                  {unreadCount > 0 && (
                    <View style={styles.chatUnreadBadge}>
                      <Text style={styles.chatUnreadBadgeText}>
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            )}

            {/* Notifications - Only show when authenticated */}
            {isAuthenticated && (
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => router.push('/(pages)/notifications')}
              >
                <View style={styles.notificationContainer}>
                  <MaterialIcons name="notifications" size={22} color={Colors.light.text} />
                  <View style={styles.notificationDot} />
                </View>
              </TouchableOpacity>
            )}

            {/* Create Ad - Only show when authenticated */}
            {isAuthenticated && (
              <TouchableOpacity
                style={styles.createAdButton}
                onPress={() => router.push('/(pages)/create-ad')}
              >
                <Text style={styles.createAdButtonText}>Create Post</Text>
              </TouchableOpacity>
            )}

            {/* Profile/Login - Show login button when not authenticated, profile when authenticated */}
            {isAuthenticated ? (
              <TouchableOpacity
                style={styles.avatarButton}
                onPress={() => router.push('/(pages)/update-profile')}
              >
                {user?.avatar ? (
                  <NetworkImage
                    source={{ uri: user.avatar }}
                    style={styles.avatarImage}
                  />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <MaterialIcons name="account-circle" size={24} color={Colors.light.text} />
                  </View>
                )}
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.actionButton, styles.loginButton]}
                onPress={() => router.push('/(auth)/login')}
              >
                <MaterialIcons name="login" size={22} color="#FFFFFF" />
                <Text style={styles.loginButtonText}>Login</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>

      <UnifiedLocationPicker
        visible={locationPickerVisible}
        onClose={() => {
          setLocationPickerVisible(false);
          setShowPreciseOnly(false);
        }}
        onLocationSelect={handleLocationSelect}
        currentLocation={currentLocation}
        mode="modal"
        showPreciseLocationPicker={showPreciseOnly}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.backgroundSecondary,
    zIndex: 1000,
    position: 'relative',
    ...Shadows.soft,
  },
  topBar: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: 16,
    minHeight: 72,
  },
  navContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    maxWidth: 1300,
    alignSelf: 'center',
    paddingHorizontal: 40,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  logo: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  logoWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  textColumn: {
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  brandName: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.light.text,
    lineHeight: 22,
    fontFamily: Fonts?.sans || 'System',
  },
  tagline: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.light.primary,
    letterSpacing: 1,
    lineHeight: 14,
    marginTop: -2,
    fontFamily: Fonts?.sans || 'System',
  },
  logoSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  menuButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: Colors.light.backgroundSecondary,
  },
  searchSection: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 32,
    gap: 8,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 25,
    height: 40,
    overflow: 'hidden',
  },
  searchContainerFocused: {
    backgroundColor: '#E8E8E8', // Slightly darker gray on focus
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: Colors.light.text,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: 'transparent',
    borderRadius: 25,
    borderWidth: 0,
    borderColor: 'transparent',
    outlineWidth: 0,
    outlineColor: 'transparent',
    outlineStyle: 'none',
    borderStyle: 'solid',
    fontFamily: Fonts?.sans || 'System',
  },
  searchInputFocused: {
    // No background change, stays transparent
  },
  searchButton: {
    position: 'absolute',
    right: 12,
    padding: 4,
  },
  rightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    minWidth: 300,
    justifyContent: 'flex-end',
  },
  headerLocationPicker: {
    minWidth: 200,
    width: 'auto',
  },
  actionButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: Colors.light.backgroundSecondary,
  },
  chatIconWrap: {
    position: 'relative',
  },
  chatUnreadBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Colors.light.primary,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  chatUnreadBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  notificationContainer: {
    position: 'relative',
  },
  notificationDot: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.light.primary,
  },
  filterButton: {
    width: 40,
    height: 40,
    backgroundColor: Colors.light.backgroundSecondary,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loginButton: {
    backgroundColor: Colors.light.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loginButtonText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
    fontFamily: Fonts?.sans || 'System',
  },
  createAdButton: {
    backgroundColor: Colors.light.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  createAdButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  avatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.light.backgroundSecondary,
  },
  avatarButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.light.backgroundSecondary,
  },
  avatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.light.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
