import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Dimensions } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

import { Colors } from '@/constants/theme';
import { ThemedText } from '@/components/themed-text';
import { GradientButton } from '@/components/ui/gradient-button';
import { FloatingLabelInput } from '@/components/ui/floating-label-input';
import { BaseBottomSheet } from '@/components/ui/base-bottom-sheet';
import { UnifiedLocationPicker } from '@/components/ui/unified-location-picker';
import { LocationSuggestion } from '@/types/location.types';
import { categoriesService } from '@/services';
import { formatPriceInput } from '@/utils/price-formatter';
import type { Category, Subcategory } from '@/types/api.types';

export type FilterOptions = {
  category: string; // Category name for display
  categoryId?: string; // Category ID for API
  subcategoryId?: string; // Subcategory ID for API
  subcategoryName?: string; // Subcategory name for display
  priceRange: {
    min: string;
    max: string;
  };
  location?: string; // Store location name for display (deprecated, use locationLatitude/Longitude instead)
  locationName?: string; // Store location name for display
  locationLatitude?: number; // Store latitude for coordinate-based search
  locationLongitude?: number; // Store longitude for coordinate-based search
  sortBy: string;
};

export type FilterBottomSheetProps = {
  visible: boolean;
  onClose: () => void;
  onApply: (filters: FilterOptions) => void;
  onReset: () => void;
  filters: FilterOptions;
};

const SORT_OPTIONS = [
  'Most Recent',
  'Price: Low to High',
  'Price: High to Low'
];

export function FilterBottomSheet({
  visible,
  onClose,
  onApply,
  onReset,
  filters
}: FilterBottomSheetProps) {
  const [localFilters, setLocalFilters] = useState<FilterOptions>(filters);
  const [locationPickerVisible, setLocationPickerVisible] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [loadingSubcategories, setLoadingSubcategories] = useState(false);

  // Sync local filters with context filters when sheet first opens
  useEffect(() => {
    if (visible) {
      setLocalFilters(filters);
    }
  }, [visible]);

  // Load categories when the bottom sheet becomes visible
  useEffect(() => {
    if (visible) {
      loadCategories();
    }
  }, [visible]);

  const loadCategories = async () => {
    try {
      setLoadingCategories(true);
      const response = await categoriesService.getCategories();
      if (response.success && response.data) {
        setCategories(response.data);
      }
    } catch (error) {
      // Set an empty array so the UI renders properly
      setCategories([]);
    } finally {
      setLoadingCategories(false);
    }
  };

  const handleCategorySelect = (categoryName: string) => {
    // Find the category object to get its ID
    const selectedCategory = categories.find(cat => cat.name === categoryName);

    setLocalFilters(prev => ({
      ...prev,
      category: categoryName,
      categoryId: selectedCategory ? selectedCategory.id : undefined,
      subcategoryId: undefined,
      subcategoryName: undefined
    }));
  };

  // Load subcategories when a category is selected
  useEffect(() => {
    if (localFilters.categoryId && localFilters.category !== 'All Categories') {
      loadSubcategories(localFilters.categoryId);
    } else {
      setSubcategories([]);
    }
  }, [localFilters.categoryId]);

  const loadSubcategories = async (categoryId: string) => {
    try {
      setLoadingSubcategories(true);
      const response = await categoriesService.getCategorySubcategories(categoryId);
      if (response.success && response.data) {
        setSubcategories(response.data);
      } else {
        setSubcategories([]);
      }
    } catch (error) {
      setSubcategories([]);
    } finally {
      setLoadingSubcategories(false);
    }
  };

  const handleSubcategorySelect = (subcategory: Subcategory) => {
    setLocalFilters(prev => ({
      ...prev,
      subcategoryId: subcategory.id,
      subcategoryName: subcategory.name
    }));
  };

  const handleClearSubcategory = () => {
    setLocalFilters(prev => ({
      ...prev,
      subcategoryId: undefined,
      subcategoryName: undefined
    }));
  };

  const handleSortSelect = (sortBy: string) => {
    setLocalFilters(prev => ({ ...prev, sortBy }));
  };

  const handlePriceChange = (field: 'min' | 'max', value: string) => {
    // Only allow numbers - remove any non-numeric characters
    const numericValue = value.replace(/[^0-9]/g, '');
    setLocalFilters(prev => ({
      ...prev,
      priceRange: {
        ...prev.priceRange,
        [field]: numericValue
      }
    }));
  };

  const handleLocationChange = (location: string) => {
    setLocalFilters(prev => ({ ...prev, location }));
  };

  const handleLocationSelect = (location: LocationSuggestion) => {
    setLocalFilters(prev => ({
      ...prev,
      location: location.displayName, // Store display name for UI
      locationName: location.displayName, // Store name for display
      locationLatitude: location.latitude, // Store latitude for coordinate-based search
      locationLongitude: location.longitude // Store longitude for coordinate-based search
    }));
    setLocationPickerVisible(false);
  };

  const handleApply = () => {
    onApply(localFilters);
    onClose();
  };

  const handleReset = () => {
    const resetFilters: FilterOptions = {
      category: 'All Categories',
      categoryId: undefined,
      subcategoryId: undefined,
      subcategoryName: undefined,
      priceRange: { min: '', max: '' },
      location: undefined,
      locationName: undefined,
      locationLatitude: undefined,
      locationLongitude: undefined,
      sortBy: 'Most Recent'
    };
    setLocalFilters(resetFilters);
    setSubcategories([]);
    onReset();
  };

  return (
    <BaseBottomSheet
      visible={visible}
      onClose={onClose}
      title="Filters"
      showResetButton={true}
      onReset={handleReset}
      resetText="Reset"
    >
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Category */}
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Category</ThemedText>
          {loadingCategories ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color={Colors.light.primary} />
              <ThemedText style={styles.loadingText}>Loading categories...</ThemedText>
            </View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll}>
              <View style={styles.tagContainer}>
                <TouchableOpacity
                  key="All Categories"
                  style={[
                    styles.tag,
                    localFilters.category === 'All Categories' && styles.tagSelected
                  ]}
                  onPress={() => handleCategorySelect('All Categories')}
                >
                  <ThemedText style={[
                    styles.tagText,
                    localFilters.category === 'All Categories' && styles.tagTextSelected
                  ]}>
                    All Categories
                  </ThemedText>
                </TouchableOpacity>
                {categories.map((category) => (
                  <TouchableOpacity
                    key={category.id}
                    style={[
                      styles.tag,
                      localFilters.category === category.name && styles.tagSelected
                    ]}
                    onPress={() => handleCategorySelect(category.name)}
                  >
                    <ThemedText style={[
                      styles.tagText,
                      localFilters.category === category.name && styles.tagTextSelected
                    ]}>
                      {category.name}
                    </ThemedText>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          )}
        </View>

        {/* Subcategory */}
        {localFilters.categoryId && localFilters.category !== 'All Categories' && (
          <View style={styles.section}>
            <View style={styles.subcategoryHeader}>
              <ThemedText style={styles.sectionTitle}>Subcategory</ThemedText>
              {localFilters.subcategoryId && (
                <TouchableOpacity onPress={handleClearSubcategory}>
                  <ThemedText style={styles.clearText}>Clear</ThemedText>
                </TouchableOpacity>
              )}
            </View>
            {loadingSubcategories ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color={Colors.light.primary} />
                <ThemedText style={styles.loadingText}>Loading subcategories...</ThemedText>
              </View>
            ) : subcategories.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll}>
                <View style={styles.tagContainer}>
                  {/* All option */}
                  <TouchableOpacity
                    style={[
                      styles.tag,
                      !localFilters.subcategoryId && styles.tagSelected
                    ]}
                    onPress={handleClearSubcategory}
                  >
                    <ThemedText style={[
                      styles.tagText,
                      !localFilters.subcategoryId && styles.tagTextSelected
                    ]}>
                      All {localFilters.category}
                    </ThemedText>
                  </TouchableOpacity>
                  {subcategories.map((subcategory) => (
                    <TouchableOpacity
                      key={subcategory.id}
                      style={[
                        styles.tag,
                        localFilters.subcategoryId === subcategory.id && styles.tagSelected
                      ]}
                      onPress={() => handleSubcategorySelect(subcategory)}
                    >
                      <ThemedText style={[
                        styles.tagText,
                        localFilters.subcategoryId === subcategory.id && styles.tagTextSelected
                      ]}>
                        {subcategory.name}
                      </ThemedText>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            ) : (
              <ThemedText style={styles.noSubcategoriesText}>No subcategories available</ThemedText>
            )}
          </View>
        )}

        {/* Price Range */}
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Price Range</ThemedText>
          <View style={styles.priceContainer}>
            <View style={styles.priceInput}>
              <FloatingLabelInput
                label="Min Price"
                value={formatPriceInput(localFilters.priceRange.min)}
                onChangeText={(value) => handlePriceChange('min', value)}
                placeholder="0"
                keyboardType="numeric"
                leftIcon={<Text style={styles.currencySymbol}>₹</Text>}
                containerStyle={styles.priceInputContainer}
              />
            </View>
            <View style={styles.priceSeparator}>
              <MaterialIcons name="remove" size={20} color={Colors.light.textSecondary} />
            </View>
            <View style={styles.priceInput}>
              <FloatingLabelInput
                label="Max Price"
                value={formatPriceInput(localFilters.priceRange.max)}
                onChangeText={(value) => handlePriceChange('max', value)}
                placeholder="1000"
                keyboardType="numeric"
                leftIcon={<Text style={styles.currencySymbol}>₹</Text>}
                containerStyle={styles.priceInputContainer}
              />
            </View>
          </View>
        </View>

        {/* Location */}
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Location</ThemedText>
          <TouchableOpacity
            style={styles.locationButton}
            onPress={() => setLocationPickerVisible(true)}
          >
            <MaterialIcons 
              name="location-on" 
              size={20} 
              color={Colors.light.textSecondary} 
            />
            <ThemedText style={styles.locationButtonText}>
              {localFilters.locationName || 'Select location'}
            </ThemedText>
            <MaterialIcons 
              name="arrow-forward-ios" 
              size={16} 
              color={Colors.light.textSecondary} 
            />
          </TouchableOpacity>
        </View>

        {/* Sort By */}
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Sort By</ThemedText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll}>
            <View style={styles.tagContainer}>
              {SORT_OPTIONS.map((sortOption) => (
                <TouchableOpacity
                  key={sortOption}
                  style={[
                    styles.tag,
                    localFilters.sortBy === sortOption && styles.tagSelected
                  ]}
                  onPress={() => handleSortSelect(sortOption)}
                >
                  <ThemedText style={[
                    styles.tagText,
                    localFilters.sortBy === sortOption && styles.tagTextSelected
                  ]}>
                    {sortOption}
                  </ThemedText>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <GradientButton
            title="Apply Filters"
            onPress={handleApply}
            style={styles.applyButton}
          />
        </View>
      </ScrollView>

      <UnifiedLocationPicker
        visible={locationPickerVisible}
        onClose={() => setLocationPickerVisible(false)}
        onLocationSelect={handleLocationSelect}
        mode={Dimensions.get('window').width > 768 ? "modal" : "bottom-sheet"}
      />
    </BaseBottomSheet>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  section: {
    marginVertical: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 12,
  },
  horizontalScroll: {
    marginBottom: 8,
  },
  tagContainer: {
    flexDirection: 'row',
    gap: 8,
    paddingRight: 20,
  },
  tag: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  tagSelected: {
    backgroundColor: Colors.light.primary,
    borderColor: Colors.light.primary,
  },
  tagText: {
    fontSize: 14,
    color: Colors.light.text,
    fontWeight: '500',
  },
  tagTextSelected: {
    color: '#FFFFFF',
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
  },
  priceInput: {
    flex: 1,
  },
  priceInputContainer: {
    marginBottom: 0,
  },
  priceSeparator: {
    alignItems: 'center',
    paddingBottom: 24,
  },
  currencySymbol: {
    fontSize: 16,
    color: Colors.light.textSecondary,
  },
  locationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    gap: 12,
  },
  locationButtonText: {
    flex: 1,
    fontSize: 15,
    color: Colors.light.text,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 32,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  applyButton: {
    marginBottom: 0,
  },
  loadingContainer: {
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 8,
    fontSize: 14,
    color: Colors.light.textSecondary,
  },
  subcategoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  clearText: {
    fontSize: 14,
    color: Colors.light.primary,
    fontWeight: '600',
  },
  noSubcategoriesText: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    fontStyle: 'italic',
  },
});