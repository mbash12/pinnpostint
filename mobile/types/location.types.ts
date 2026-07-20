/**
 * Location Types
 * Types for location selection and Google Maps integration
 */

export interface LocationSuggestion {
  id: string;
  name: string;
  displayName: string;
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
  type?: string;
  placeId?: string;
}

export interface RecentLocation {
  id: string;
  name: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  city?: string;
  state?: string;
  country: string;
  postalCode?: string;
  lastUsed: string;
  usageCount?: number;
}

export interface PopularLocation {
  id: string;
  name: string;
  state?: string;
  country: string;
  city?: string;
}

export type UnifiedLocationPickerMode = 'modal' | 'bottom-sheet';

export interface UnifiedLocationPickerProps {
  visible: boolean;
  onClose: () => void;
  onLocationSelect: (location: LocationSuggestion) => void;
  currentLocation?: LocationSuggestion;
  mode?: UnifiedLocationPickerMode;
  showPreciseLocationPicker?: boolean;
}

/**
 * Verbose address fields for ad location
 * Used instead of locationId reference
 */
export interface AdLocation {
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
}
