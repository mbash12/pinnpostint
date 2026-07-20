import { MaterialIcons } from '@expo/vector-icons';
import { useRouter, usePathname } from 'expo-router';
import { useState, useMemo, useRef, useEffect } from 'react';
import { StyleSheet, Text, TouchableOpacity, View, ActivityIndicator, Platform, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { UnifiedLocationPicker } from '@/components/ui/unified-location-picker';
import { LocationSuggestion } from '@/types/location.types';
import { Colors, Shadows, Fonts } from '@/constants/theme';
import { useCurrentLocation } from '@/hooks/use-current-location';
import { useSelectedLocation, type SelectedLocation } from '@/contexts/location-context';
import { useAuth } from '@/contexts/auth-context';
import { useBackNavigation } from '@/utils/navigation-helpers';
import { useUnreadChatCount } from '@/hooks/use-unread-chat-count';

export type HeaderProps = {
  title?: string;
  showBack?: boolean;
  onLocationChange?: (location: LocationSuggestion) => void;
};

export function Header({ title = 'Pin N Post', showBack = false, onLocationChange }: HeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { goBack } = useBackNavigation();
  const [locationPickerVisible, setLocationPickerVisible] = useState(false);
  const [showPreciseOnly, setShowPreciseOnly] = useState(false);
  const { location: geolocation, isLoading: locationLoading, fetchLocation, permissionGranted } = useCurrentLocation();
  const { selectedLocation, setSelectedLocation } = useSelectedLocation();
  const { isAuthenticated } = useAuth();
  const { unreadCount, fetchUnreadCount } = useUnreadChatCount();

  const chatBadgeLabel = unreadCount > 99 ? '99+' : String(unreadCount);

  // Fetch unread count when route changes
  useEffect(() => {
    if (isAuthenticated && !pathname?.includes('/chat')) {
      fetchUnreadCount();
    }
  }, [pathname, isAuthenticated, fetchUnreadCount]);

  // Memoize the current location to prevent unnecessary re-renders
  const currentLocation: LocationSuggestion = useMemo(() => {
    // If user has manually selected a location, convert to LocationSuggestion format
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

  return (
    <>
      <View style={[styles.safeArea, { top: 0, paddingTop: insets.top }]} pointerEvents="box-none">
        <View style={styles.container}>
          {/* Logo or Back button */}
          <View style={styles.logoContainer}>
            {showBack ? (
              <View style={styles.logoCircle}>
                <TouchableOpacity style={styles.backButton} onPress={goBack}>
                  <MaterialIcons name="arrow-back" size={22} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <TouchableOpacity style={[styles.logoCircle, styles.logoCircleTransparent]} onPress={() => router.push('/')}>
                  <Image source={require('@/assets/images/logo.png')} style={styles.logoImage} />
                </TouchableOpacity>
              </>
            )}
          </View>

          {/* Location */}
          <TouchableOpacity
            style={styles.locationContainer}
            onPress={() => setLocationPickerVisible(true)}
          >
            <View style={styles.locationTextContainer}>
              <Text style={styles.locationLabel}>Current location</Text>
              <View style={styles.locationRow}>
                {locationLoading && !currentLocation.name ? (
                  <ActivityIndicator size="small" color={Colors.light.primary} />
                ) : (
                  <>
                    <Text style={styles.locationValue} numberOfLines={1}>{currentLocation.displayName}</Text>
                    <MaterialIcons name="keyboard-arrow-down" size={18} color={Colors.light.text} />
                  </>
                )}
              </View>
            </View>
          </TouchableOpacity>

          {/* Icons */}
          <View style={styles.iconsContainer}>
            {/* Create Ad - Only show when authenticated */}
            {isAuthenticated && (
              <TouchableOpacity
                style={styles.iconButton}
                onPress={() => router.push('/(pages)/create-ad')}
              >
                <MaterialIcons name="add-circle" size={26} color={Colors.light.primary} />
              </TouchableOpacity>
            )}

            {/* Search Icon - Navigate to browse and focus search on mobile */}
            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => {
                if (Platform.OS !== 'web' || Dimensions.get('window').width <= 768) {
                  // Mobile: Navigate to browse and focus search input
                  router.push('/(tabs)/browse?focusSearch=true');
                } else {
                  // Desktop: Just navigate to browse
                  router.push('/(tabs)/browse');
                }
              }}
            >
              <MaterialIcons name="search" size={26} color={Colors.light.text} />
            </TouchableOpacity>

            {/* Chat */}
            {isAuthenticated && (
              <TouchableOpacity style={styles.iconButton} onPress={() => router.push('/(pages)/chat' as any)}>
                <View style={styles.chatIconWrap}>
                  <MaterialIcons name="chat-bubble-outline" size={26} color={Colors.light.text} />
                  {unreadCount > 0 && (
                    <View style={styles.chatUnreadBadge}>
                      <Text style={styles.chatUnreadBadgeText}>{chatBadgeLabel}</Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            )}

            {/* Notifications - Only show when authenticated */}
            {isAuthenticated && (
              <TouchableOpacity style={styles.iconButton} onPress={() => router.push('/(pages)/notifications')}>
                <View style={styles.notificationContainer}>
                  <MaterialIcons name="notifications-none" size={26} color={Colors.light.text} />
                  <View style={styles.notificationDot} />
                </View>
              </TouchableOpacity>
            )}

            {/* Login button for non-authenticated users */}
            {!isAuthenticated && (
              <TouchableOpacity
                style={styles.iconButton}
                onPress={() => router.push('/(auth)/login')}
              >
                <MaterialIcons name="login" size={26} color={Colors.light.text} />
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
        mode={Dimensions.get('window').width > 768 ? "modal" : "bottom-sheet"}
        showPreciseLocationPicker={showPreciseOnly}
      />
    </>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: 'transparent',
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 1000,
  },
  container: {
    minHeight: 80,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.backgroundSecondary,
    paddingBottom: 10,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    ...Shadows.soft,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.light.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 4,
  },
  logoCircleTransparent: {
    backgroundColor: 'transparent',
  },
  logoImage: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  taglineContainer: {
    marginLeft: 4,
    flexDirection: 'column',
  },
  taglineText: {
    fontSize: 8,
    fontWeight: '700',
    color: Colors.light.primary,
    letterSpacing: 0.5,
    lineHeight: 10,
    fontFamily: Fonts?.sans || 'System',
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 8,
  },
  locationIcon: {
    fontSize: 16,
    marginRight: 6,
  },
  locationTextContainer: {
    flex: 1,
  },
  locationLabel: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    fontWeight: '500',
    marginBottom: 2,
    fontFamily: Fonts?.sans || 'System',
  },
  locationValue: {
    fontSize: 15,
    color: Colors.light.text,
    fontWeight: '600',
    flex: 1,
    fontFamily: Fonts?.sans || 'System',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  iconsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 0,
  },
  iconButton: {
    padding: 8,
  },
  chatIconWrap: {
    position: 'relative',
  },
  chatUnreadBadge: {
    position: 'absolute',
    top: -4,
    right: -6,
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
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.light.primary,
  },
  notificationBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#FF4444',
    justifyContent: 'center' as any,
    alignItems: 'center' as any,
    paddingHorizontal: 4,
  },
  notificationBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
    lineHeight: 12,
  },
  backButton: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarImage: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.light.backgroundSecondary,
  },

});