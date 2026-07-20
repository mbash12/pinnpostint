import React from 'react';
import { useRouter, usePathname } from 'expo-router';
import { FilterBottomSheet, FilterOptions } from '@/components/ui/filter-bottom-sheet';
import { useFilter } from '@/hooks/use-filter';

export function GlobalFilterBottomSheet() {
  const { filters, showFilter, setShowFilter, handleApplyFilters, handleResetFilters } = useFilter();
  const router = useRouter();
  const pathname = usePathname();

  const handleApply = (newFilters: FilterOptions) => {
    // Prevent multiple executions if filter is already closing
    if (!showFilter) return;

    handleApplyFilters(newFilters);
    setShowFilter(false);

    // Navigate to browse screen with the applied filters
    const params: any = {};
    if (newFilters.priceRange.min) params.minPrice = newFilters.priceRange.min;
    if (newFilters.priceRange.max) params.maxPrice = newFilters.priceRange.max;
    if (newFilters.locationLatitude && newFilters.locationLongitude) {
      params.locationLatitude = newFilters.locationLatitude;
      params.locationLongitude = newFilters.locationLongitude;
      params.locationName = newFilters.locationName;
    }
    if (newFilters.sortBy && newFilters.sortBy !== 'Most Recent') params.sortBy = newFilters.sortBy;
    if (newFilters.categoryId) {
      params.categoryId = newFilters.categoryId;
      params.category = newFilters.category;
      if (newFilters.subcategoryId) {
        params.subcategoryId = newFilters.subcategoryId;
        params.subcategoryName = newFilters.subcategoryName;
      }
    }

    // If already on browse page, use setParams, otherwise push
    if (pathname?.includes('browse')) {
      router.setParams(params);
    } else {
      router.push({
        pathname: '/(tabs)/browse',
        params
      });
    }
  };

  const handleClose = () => {
    // Only set to false if it's currently visible
    if (showFilter) {
      setShowFilter(false);
    }
  };

  const handleReset = () => {
    // Prevent multiple executions if filter is already closing
    if (!showFilter) return;

    handleResetFilters();
    setShowFilter(false);

    // Navigate to browse screen with reset filters
    if (pathname?.includes('browse')) {
      // Clear all filter params by replacing the route with only non-filter params
      router.replace({
        pathname: '/(tabs)/browse',
        params: {}
      });
    } else {
      router.push({
        pathname: '/(tabs)/browse',
        params: {}
      });
    }
  };

  return (
    <FilterBottomSheet
      visible={showFilter}
      onClose={handleClose}
      onApply={handleApply}
      onReset={handleReset}
      filters={filters}
    />
  );
}