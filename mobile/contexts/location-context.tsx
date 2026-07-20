import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';

const SELECTED_LOCATION_KEY = '@selected_location';
const LOCATION_ALERT_DISMISSED = '@location_alert_dismissed_v2';

export interface SelectedLocation {
  id: string;
  name: string;
  city?: string;
  state: string;
  country: string;
  latitude?: number;
  longitude?: number;
  address?: {
    road?: string;
    house_number?: string;
    city?: string;
    state?: string;
    country: string;
    postalCode?: string;
    formatted: string;
  };
}

export type PermissionStatus = 'unknown' | 'granted' | 'denied';

interface LocationContextType {
  selectedLocation: SelectedLocation | null;
  setSelectedLocation: (location: SelectedLocation | null) => void;
  permissionStatus: PermissionStatus;
  requestPermission: () => Promise<boolean>;
  showBanner: boolean;
  dismissBanner: () => void;
}

const LocationContext = createContext<LocationContextType | undefined>(undefined);

export function LocationProvider({ children }: { children: React.ReactNode }) {
  const [selectedLocation, setSelectedLocationState] = useState<SelectedLocation | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<PermissionStatus>('unknown');
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    loadSelectedLocation();
    checkPermissionStatus();
  }, []);

  const loadSelectedLocation = async () => {
    try {
      const stored = await AsyncStorage.getItem(SELECTED_LOCATION_KEY);
      if (stored) {
        setSelectedLocationState(JSON.parse(stored));
      }
    } catch (error) {
    }
  };

  const checkPermissionStatus = async () => {
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status === 'granted') {
        setPermissionStatus('granted');
        setShowBanner(false);
      } else {
        setPermissionStatus('denied');
        // Check if user dismissed the alert before showing banner
        const dismissed = await AsyncStorage.getItem(LOCATION_ALERT_DISMISSED);
        setShowBanner(dismissed !== 'true');
      }
    } catch (error) {
      setPermissionStatus('denied');
      setShowBanner(true);
    }
  };

  const requestPermission = useCallback(async (): Promise<boolean> => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        setPermissionStatus('granted');
        setShowBanner(false);
        // Clear dismissed flag when permission is granted
        await AsyncStorage.removeItem(LOCATION_ALERT_DISMISSED);
        return true;
      } else {
        setPermissionStatus('denied');
        return false;
      }
    } catch (error) {
      setPermissionStatus('denied');
      return false;
    }
  }, []);

  const dismissBanner = useCallback(async () => {
    setShowBanner(false);
    // Save dismissed flag so banner doesn't show again
    await AsyncStorage.setItem(LOCATION_ALERT_DISMISSED, 'true');
  }, []);

  const setSelectedLocation = async (location: SelectedLocation | null) => {
    try {
      if (location) {
        await AsyncStorage.setItem(SELECTED_LOCATION_KEY, JSON.stringify(location));
        // Clear dismissed flag when location is set
        await AsyncStorage.removeItem(LOCATION_ALERT_DISMISSED);
      } else {
        await AsyncStorage.removeItem(SELECTED_LOCATION_KEY);
      }
      setSelectedLocationState(location);
    } catch (error) {
    }
  };

  return (
    <LocationContext.Provider value={{
      selectedLocation,
      setSelectedLocation,
      permissionStatus,
      requestPermission,
      showBanner,
      dismissBanner,
    }}>
      {children}
    </LocationContext.Provider>
  );
}

export function useSelectedLocation() {
  const context = useContext(LocationContext);
  if (context === undefined) {
    throw new Error('useSelectedLocation must be used within a LocationProvider');
  }
  return context;
}
