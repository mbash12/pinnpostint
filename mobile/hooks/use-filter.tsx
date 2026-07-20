import { useState, createContext, useContext, useMemo, useEffect, useCallback, ReactNode } from 'react';
import { useLocalSearchParams, useRouter, usePathname } from 'expo-router';
import { FilterOptions } from '@/components/ui/filter-bottom-sheet';
import { Platform } from 'react-native';

interface FilterContextType {
  filters: FilterOptions;
  setFilters: (filters: FilterOptions) => void;
  showFilter: boolean;
  setShowFilter: (show: boolean) => void;
  handleApplyFilters: (filters: FilterOptions) => void;
  handleResetFilters: () => void;
  syncMobileParams: (params: Record<string, string | undefined>) => void;
}

const defaultFilters: FilterOptions = {
  category: 'All Categories',
  categoryId: undefined,
  priceRange: { min: '', max: '' },
  location: undefined,
  locationName: undefined,
  locationLatitude: undefined,
  locationLongitude: undefined,
  sortBy: 'Most Recent'
};

const FilterContext = createContext<FilterContextType | undefined>(undefined);

export function FilterProvider({ children }: { children: ReactNode }) {
  const [showFilter, setShowFilter] = useState(false);
  const params = useLocalSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  // Store mobile params in state so they persist across navigation
  const [mobileParams, setMobileParams] = useState<Record<string, any>>({});

  // On web, read directly from URL to get child route params
  // This is necessary because useLocalSearchParams at root level
  // doesn't have access to child route params (like /browse's params)
  const [webUrlParams, setWebUrlParams] = useState<string>(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      return window.location.search;
    }
    return '';
  });

  // Update web URL params periodically to catch changes from child routes
  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const updateParams = () => {
        const currentSearch = window.location.search;
        // Only update if the search string actually changed
        setWebUrlParams(prev => {
          if (prev !== currentSearch) {
            return currentSearch;
          }
          return prev;
        });
      };
      
      // Update immediately on pathname change
      updateParams();
      
      // Also poll periodically to catch search param changes without pathname changes
      const interval = setInterval(updateParams, 200);
      
      return () => clearInterval(interval);
    }
  }, [pathname]);

  // Parse the URL params string to avoid re-parsing on every render
  const parsedWebParams = useMemo(() => {
    return new URLSearchParams(webUrlParams);
  }, [webUrlParams]);

  // Derive filters from URL params - URL is the single source of truth
  const filters = useMemo<FilterOptions>(() => {
    // On web, use the direct URL params to get child route params
    if (Platform.OS === 'web') {
      return {
        category: parsedWebParams.get('category') || 'All Categories',
        categoryId: parsedWebParams.get('categoryId') || undefined,
        subcategoryId: parsedWebParams.get('subcategoryId') || undefined,
        subcategoryName: parsedWebParams.get('subcategoryName') || undefined,
        priceRange: {
          min: parsedWebParams.get('minPrice') || '',
          max: parsedWebParams.get('maxPrice') || ''
        },
        location: parsedWebParams.get('locationName') || undefined,
        locationName: parsedWebParams.get('locationName') || undefined,
        locationLatitude: parsedWebParams.get('locationLatitude') ? parseFloat(parsedWebParams.get('locationLatitude')!) : undefined,
        locationLongitude: parsedWebParams.get('locationLongitude') ? parseFloat(parsedWebParams.get('locationLongitude')!) : undefined,
        sortBy: parsedWebParams.get('sortBy') || 'Most Recent'
      };
    }

    // On mobile/native, use stored mobile params (synced from browse screen)
    // Fallback to local params if mobileParams is empty
    const activeParams = Object.keys(mobileParams).length > 0 ? mobileParams : params;
    
    return {
      category: (activeParams.category as string) || 'All Categories',
      categoryId: activeParams.categoryId ? (activeParams.categoryId as string) : undefined,
      subcategoryId: activeParams.subcategoryId ? (activeParams.subcategoryId as string) : undefined,
      subcategoryName: activeParams.subcategoryName ? (activeParams.subcategoryName as string) : undefined,
      priceRange: {
        min: (activeParams.minPrice as string) || '',
        max: (activeParams.maxPrice as string) || ''
      },
      location: (activeParams.locationName as string) || undefined,
      locationName: (activeParams.locationName as string) || undefined,
      locationLatitude: activeParams.locationLatitude ? parseFloat(activeParams.locationLatitude as string) : undefined,
      locationLongitude: activeParams.locationLongitude ? parseFloat(activeParams.locationLongitude as string) : undefined,
      sortBy: (activeParams.sortBy as string) || 'Most Recent'
    };
  }, [params, parsedWebParams, mobileParams]);

  // setFilters is now a no-op since URL is the source of truth
  // This is kept for backward compatibility
  const setFilters = (newFilters: FilterOptions) => {
    // Don't do anything - filters come from URL
  };

  // Function to sync params from child routes (browse screen) on mobile
  const syncMobileParams = useCallback((newParams: Record<string, string | undefined>) => {
    setMobileParams(newParams);
  }, []);

  const handleApplyFilters = (newFilters: FilterOptions) => {
    // Build params object
    const newParams: any = {
      minPrice: newFilters.priceRange.min || undefined,
      maxPrice: newFilters.priceRange.max || undefined,
      locationLatitude: (newFilters.locationLatitude !== undefined && newFilters.locationLongitude !== undefined)
        ? newFilters.locationLatitude
        : undefined,
      locationLongitude: (newFilters.locationLatitude !== undefined && newFilters.locationLongitude !== undefined)
        ? newFilters.locationLongitude
        : undefined,
      locationName: (newFilters.locationLatitude !== undefined && newFilters.locationLongitude !== undefined)
        ? newFilters.locationName
        : undefined,
      sortBy: (newFilters.sortBy && newFilters.sortBy !== 'Most Recent') ? newFilters.sortBy : undefined,
      categoryId: newFilters.categoryId || undefined,
      category: newFilters.categoryId ? newFilters.category : undefined,
      subcategoryId: newFilters.subcategoryId || undefined,
      subcategoryName: newFilters.subcategoryId ? newFilters.subcategoryName : undefined,
    };

    // Filter out undefined params
    const cleanParams = Object.fromEntries(
      Object.entries(newParams).filter(([_, value]) => value !== undefined)
    );

    // Update URL
    router.setParams(cleanParams as any);
  };

  const handleResetFilters = () => {
    // Clear all filter params by navigating without params
    router.replace({
      pathname: (pathname as any) || '/(tabs)/browse',
      params: {}
    });
    
    // Also clear mobile params
    setMobileParams({});
  };

  return (
    <FilterContext.Provider
      value={{
        filters,
        setFilters,
        showFilter,
        setShowFilter,
        handleApplyFilters,
        handleResetFilters,
        syncMobileParams
      }}
    >
      {children}
    </FilterContext.Provider>
  );
}

export function useFilter() {
  const context = useContext(FilterContext);
  if (context === undefined) {
    throw new Error('useFilter must be used within a FilterProvider');
  }
  return context;
}