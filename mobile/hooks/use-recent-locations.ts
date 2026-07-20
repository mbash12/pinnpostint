/**
 * Recent Locations Hook
 * Custom hook for managing recent locations with API integration
 */

import { useState, useEffect, useCallback } from 'react';
import { recentLocationsService, RecentLocation, SaveLocationRequest } from '@/services/recent-locations.service';

export interface UseRecentLocationsOptions {
  autoLoad?: boolean;
  limit?: number;
}

export interface UseRecentLocationsReturn {
  recentLocations: RecentLocation[];
  isLoading: boolean;
  error: string | null;
  saveLocation: (locationData: SaveLocationRequest) => Promise<RecentLocation | null>;
  updateLocationUsage: (locationId: string) => Promise<void>;
  deleteLocation: (locationId: string) => Promise<void>;
  clearRecentLocations: () => Promise<void>;
  refreshLocations: () => Promise<void>;
}

export function useRecentLocations(options: UseRecentLocationsOptions = {}): UseRecentLocationsReturn {
  const { autoLoad = true, limit } = options;
  
  const [recentLocations, setRecentLocations] = useState<RecentLocation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadRecentLocations = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const locations = await recentLocationsService.getRecentLocations();
      const limitedLocations = limit ? locations.slice(0, limit) : locations;
      setRecentLocations(limitedLocations);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load recent locations';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [limit]);

  const saveLocation = useCallback(async (locationData: SaveLocationRequest): Promise<RecentLocation | null> => {
    setError(null);
    try {
      const savedLocation = await recentLocationsService.saveLocation(locationData);
      if (savedLocation) {
        // Update local state
        setRecentLocations(prev => {
          const filtered = prev.filter(loc => loc.id !== savedLocation.id);
          return [savedLocation, ...filtered].slice(0, limit || 10);
        });
      }
      return savedLocation;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save location';
      setError(errorMessage);
      return null;
    }
  }, [limit]);

  const updateLocationUsage = useCallback(async (locationId: string) => {
    setError(null);
    try {
      await recentLocationsService.updateLocationUsage(locationId);
      // Update local state
      setRecentLocations(prev => 
        prev.map(loc => 
          loc.id === locationId 
            ? { ...loc, usageCount: loc.usageCount + 1, lastUsed: new Date().toISOString() }
            : loc
        )
      );
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update location usage';
      setError(errorMessage);
    }
  }, []);

  const deleteLocation = useCallback(async (locationId: string) => {
    setError(null);
    try {
      await recentLocationsService.deleteLocation(locationId);
      // Update local state
      setRecentLocations(prev => prev.filter(loc => loc.id !== locationId));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete location';
      setError(errorMessage);
    }
  }, []);

  const clearRecentLocations = useCallback(async () => {
    setError(null);
    try {
      await recentLocationsService.clearRecentLocations();
      setRecentLocations([]);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to clear recent locations';
      setError(errorMessage);
    }
  }, []);

  const refreshLocations = useCallback(async () => {
    await loadRecentLocations();
  }, [loadRecentLocations]);

  useEffect(() => {
    if (autoLoad) {
      loadRecentLocations();
    }
  }, [autoLoad, loadRecentLocations]);

  return {
    recentLocations,
    isLoading,
    error,
    saveLocation,
    updateLocationUsage,
    deleteLocation,
    clearRecentLocations,
    refreshLocations,
  };
}
