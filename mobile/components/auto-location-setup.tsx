/**
 * Auto Location Setup Component
 * Shows location alert if location is not set (GPS might be off)
 */

import { useEffect, useState } from 'react';
import { Alert, Linking, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSelectedLocation } from '@/contexts/location-context';
import { geolocationService } from '@/services/geolocation.service';

const LOCATION_ALERT_DISMISSED = '@location_alert_dismissed_v3';

export function AutoLocationSetup() {
  const {
    selectedLocation,
    setSelectedLocation,
    permissionStatus,
  } = useSelectedLocation();
  
  const [hasChecked, setHasChecked] = useState(false);

  useEffect(() => {
    if (hasChecked) return;
    if (permissionStatus === 'unknown') return;
    
    // If location is already set, skip
    if (selectedLocation) {
      setHasChecked(true);
      return;
    }

    // Location is not set - check if we should show alert
    checkAndShowAlert();
  }, [permissionStatus, selectedLocation, hasChecked]);

  const checkAndShowAlert = async () => {
    try {
      const dismissed = await AsyncStorage.getItem(LOCATION_ALERT_DISMISSED);
      
      if (dismissed === 'true') {
        setHasChecked(true);
        return;
      }

      setHasChecked(true);
      showLocationAlert();
    } catch (error) {
      setHasChecked(true);
    }
  };

  const openLocationSettings = async () => {
    try {
      if (Platform.OS === 'ios') {
        await Linking.openURL('app-settings:');
      } else {
        // Open location settings on Android
        await Linking.sendIntent('android.settings.LOCATION_SOURCE_SETTINGS');
      }
    } catch (error) {
      // Fallback to app settings
      try {
        await Linking.openSettings();
      } catch (e) {
        // Silent fail
      }
    }
  };

  const showLocationAlert = () => {
    Alert.alert(
      'Enable Location Services',
      'Pin N Post uses your location to show nearby ads and relevant listings in your area. Please enable Location/GPS in settings.',
      [
        {
          text: 'Not Now',
          style: 'cancel',
          onPress: async () => {
            await AsyncStorage.setItem(LOCATION_ALERT_DISMISSED, 'true');
          },
        },
        {
          text: 'Enable',
          onPress: async () => {
            // Open location settings
            await openLocationSettings();
          },
        },
      ],
      { cancelable: false }
    );
  };

  const setupLocationSilently = async () => {
    try {
      const servicesEnabled = await geolocationService.areLocationServicesEnabled();
      if (!servicesEnabled) return;

      const geoLocation = await geolocationService.getGeolocation();
      if (!geoLocation) return;

      const locationToSet = {
        id: 'current',
        name: geoLocation.address.city
          ? `${geoLocation.address.city}, ${geoLocation.address.state || ''}`
          : 'Current Location',
        state: geoLocation.address.state || '',
        country: geoLocation.address.country,
        latitude: geoLocation.coordinates.latitude,
        longitude: geoLocation.coordinates.longitude,
        address: {
          road: geoLocation.address.street || '',
          house_number: '',
          city: geoLocation.address.city || '',
          state: geoLocation.address.state || '',
          country: geoLocation.address.country,
          postalCode: geoLocation.address.postalCode || '',
          formatted: geoLocation.address.formatted || '',
        },
      };

      setSelectedLocation(locationToSet);
      await AsyncStorage.removeItem(LOCATION_ALERT_DISMISSED);
    } catch (error) {
      // Silent fail
    }
  };

  return null;
}
