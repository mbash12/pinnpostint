/**
 * Recent Locations Service
 * Handles saving and loading recent locations using local storage
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

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
  isCurrentLocation?: boolean;
  lastUsed: string;
  usageCount: number;
}

export interface SaveLocationRequest {
  name: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  city?: string;
  state?: string;
  country: string;
  postalCode?: string;
  isCurrentLocation?: boolean;
}

const RECENT_LOCATIONS_KEY = 'recent_locations';
const MAX_RECENT_LOCATIONS = 10;

class RecentLocationsService {
  /**
   * Get recent locations from local storage only
   */
  async getRecentLocations(): Promise<RecentLocation[]> {
    return this.getLocalRecentLocations();
  }

  /**
   * Get recent locations from local storage only
   */
  async getLocalRecentLocations(): Promise<RecentLocation[]> {
    try {
      const stored = await AsyncStorage.getItem(RECENT_LOCATIONS_KEY);
      if (stored) {
        const locations = JSON.parse(stored);
        return Array.isArray(locations) ? locations : [];
      }
    } catch (error) {
    }
    return [];
  }

  /**
   * Save a location to recent locations (local storage only)
   */
  async saveLocation(locationData: SaveLocationRequest): Promise<RecentLocation | null> {
    // Save to local storage only
    const localLocation: RecentLocation = {
      id: this.generateId(locationData),
      ...locationData,
      lastUsed: new Date().toISOString(),
      usageCount: 1,
    };
    await this.addToLocalStorage(localLocation);
    return localLocation;
  }

  /**
   * Update location usage (timestamp and count) - local storage only
   */
  async updateLocationUsage(locationId: string): Promise<void> {
    // Update local storage only
    const locations = await this.getLocalRecentLocations();
    const updatedLocations = locations.map(loc =>
      loc.id === locationId
        ? { ...loc, usageCount: loc.usageCount + 1, lastUsed: new Date().toISOString() }
        : loc
    );
    await AsyncStorage.setItem(RECENT_LOCATIONS_KEY, JSON.stringify(updatedLocations));
  }

  /**
   * Delete a recent location - local storage only
   */
  async deleteLocation(locationId: string): Promise<void> {
    // Update local storage only
    const locations = await this.getLocalRecentLocations();
    const filtered = locations.filter(loc => loc.id !== locationId);
    await AsyncStorage.setItem(RECENT_LOCATIONS_KEY, JSON.stringify(filtered));
  }

  /**
   * Clear all recent locations - local storage only
   */
  async clearRecentLocations(): Promise<void> {
    // Clear local storage only
    await AsyncStorage.removeItem(RECENT_LOCATIONS_KEY);
  }

  /**
   * Generate unique ID for local storage fallback
   */
  private generateId(data: SaveLocationRequest): string {
    if (data.latitude && data.longitude) {
      // Round to 4 decimal places for consistency (approx 11m precision)
      return `${data.latitude.toFixed(4)}_${data.longitude.toFixed(4)}`;
    }
    // Fallback to name and city/state to detect duplicates without coordinates
    const namePart = data.name.toLowerCase().trim().replace(/\s+/g, '_');
    const cityPart = (data.city || data.state || '').toLowerCase().trim().replace(/\s+/g, '_');
    return `${namePart}_${cityPart}_${data.country.toLowerCase()}`;
  }

  /**
   * Add location to local storage
   */
  private async addToLocalStorage(location: RecentLocation): Promise<void> {
    const locations = await this.getLocalRecentLocations();
    
    // Remove existing location with same ID
    const filtered = locations.filter(loc => loc.id !== location.id);
    
    // Add new location at the beginning
    const updated = [location, ...filtered].slice(0, MAX_RECENT_LOCATIONS);
    
    await AsyncStorage.setItem(RECENT_LOCATIONS_KEY, JSON.stringify(updated));
  }
}

// Export singleton instance
export const recentLocationsService = new RecentLocationsService();
export default recentLocationsService;
