import React, { useState, useEffect, useRef, useMemo } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, TextInput, Modal, ScrollView, Platform } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors } from '@/constants/theme';
import { ThemedText } from '@/components/themed-text';
import { DesktopLocationPicker } from '@/components/desktop-location-picker';
import { LocationSuggestion, AdLocation } from '@/types/location.types';
import { categoriesService } from '@/services';
import type { Category } from '@/types/api.types';
import { SearchBar, type SearchBarRef } from '@/components/search-bar';
import { formatPrice, formatPriceInput } from '@/utils/price-formatter';

export type DesktopFilterOptions = {
  category: string;
  categoryId?: string;
  subcategoryId?: string;
  subcategoryName?: string;
  priceRange: {
    min: string;
    max: string;
  };
  location?: AdLocation;
  locationName?: string;
  locationLatitude?: number;
  locationLongitude?: number;
  sortBy: string;
};

export type DesktopFiltersProps = {
  filters: DesktopFilterOptions;
  onFiltersChange: (filters: DesktopFilterOptions) => void;
  onReset: () => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onSearchSubmit?: () => void;
  onSearchClear?: () => void;
};

const SORT_OPTIONS = [
  { label: 'Most Recent', value: 'Most Recent' },
  { label: 'Price: Low to High', value: 'Price: Low to High' },
  { label: 'Price: High to Low', value: 'Price: High to Low' }
];

export function DesktopFilters({
  filters,
  onFiltersChange,
  onReset,
  searchQuery,
  onSearchChange,
  onSearchSubmit,
  onSearchClear
}: DesktopFiltersProps) {
  const insets = useSafeAreaInsets();
  const searchInputRef = useRef<SearchBarRef>(null);
  const [dropdownPosition, setDropdownPosition] = useState<{ x: number; y: number; width: number } | null>(null);
  const [activeDropdown, setActiveDropdown] = useState<'category' | 'sort' | 'price' | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const categoryButtonRef = useRef<React.ElementRef<typeof TouchableOpacity>>(null);
  const sortButtonRef = useRef<React.ElementRef<typeof TouchableOpacity>>(null);
  const priceButtonRef = useRef<React.ElementRef<typeof TouchableOpacity>>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  
  // Use formatted strings for UI, but raw strings for logic
  const [localPriceMin, setLocalPriceMin] = useState(filters.priceRange.min ? formatPriceInput(filters.priceRange.min) : '');
  const [localPriceMax, setLocalPriceMax] = useState(filters.priceRange.max ? formatPriceInput(filters.priceRange.max) : '');

  // Sync local price state with filters when filters change externally
  useEffect(() => {
    setLocalPriceMin(filters.priceRange.min ? formatPriceInput(filters.priceRange.min) : '');
    setLocalPriceMax(filters.priceRange.max ? formatPriceInput(filters.priceRange.max) : '');
  }, [filters.priceRange.min, filters.priceRange.max]);

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      const response = await categoriesService.getCategories();
      if (response.success && response.data) {
        setCategories(response.data);
      }
    } catch (error) {
      setCategories([]);
    }
  };

  const updateFilters = (updates: Partial<DesktopFilterOptions>) => {
    onFiltersChange({ ...filters, ...updates });
  };

  const handlePriceApply = () => {
    // Strip commas before applying to filter state
    updateFilters({
      priceRange: {
        min: localPriceMin.replace(/,/g, ''),
        max: localPriceMax.replace(/,/g, '')
      }
    });
    closeDropdown();
  };

  const handlePriceReset = () => {
    setLocalPriceMin('');
    setLocalPriceMax('');
    updateFilters({
      priceRange: {
        min: '',
        max: ''
      }
    });
    closeDropdown();
  };

  const hasActiveFilters =
    !!filters.categoryId ||
    !!filters.priceRange.min ||
    !!filters.priceRange.max ||
    filters.locationLatitude !== undefined ||
    (filters.sortBy !== 'Most Recent' && !!filters.sortBy) ||
    !!searchQuery;

  const toggleCategoryExpand = (categoryId: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(categoryId)) {
      newExpanded.delete(categoryId);
    } else {
      newExpanded.add(categoryId);
    }
    setExpandedCategories(newExpanded);
  };

  const openDropdown = async (type: 'category' | 'sort' | 'price', ref: React.RefObject<any>) => {
    ref.current?.measureInWindow((x, y, width, height) => {
      setDropdownPosition({ x, y: y + height, width: type === 'price' ? 280 : width });
      setActiveDropdown(type);
    });
  };

  const closeDropdown = () => {
    setActiveDropdown(null);
    setDropdownPosition(null);
  };

  // Convert AdLocation to LocationSuggestion for compatibility
  const currentLocationSuggestion: LocationSuggestion = useMemo(() => {
    return {
      id: filters.locationLatitude ? `${filters.locationLatitude}_${filters.locationLongitude}` : 'not-set',
      name: filters.locationName || 'Select location',
      displayName: filters.locationName || 'Select location',
      latitude: filters.locationLatitude || 0,
      longitude: filters.locationLongitude || 0,
      address: {
        city: filters.locationName,
        country: '',
        formatted: filters.locationName || ''
      }
    };
  }, [filters.locationLatitude, filters.locationLongitude, filters.locationName]);

  const priceDisplayText = useMemo(() => {
    if (!filters.priceRange.min && !filters.priceRange.max) return 'Any Price';
    if (filters.priceRange.min && filters.priceRange.max) return `${formatPrice(filters.priceRange.min)} - ${formatPrice(filters.priceRange.max)}`;
    if (filters.priceRange.min) return `Min ${formatPrice(filters.priceRange.min)}`;
    return `Max ${formatPrice(filters.priceRange.max)}`;
  }, [filters.priceRange.min, filters.priceRange.max]);

  return (
    <>
      <View style={styles.container}>
        {/* Header with Search */}
        <View style={styles.header}>
          <View style={styles.headerSearchContainer}>
            <SearchBar
              ref={searchInputRef}
              value={searchQuery}
              onChangeText={onSearchChange}
              onSubmitEditing={onSearchSubmit}
              onClear={onSearchClear || (() => { })}
              placeholder="Search items..."
              showFilter={false}
              containerStyle={styles.headerSearchBarContainer}
              searchRowStyle={styles.headerSearchBarRow}
            />
          </View>
          {hasActiveFilters && (
            <TouchableOpacity
              onPress={onReset}
              style={styles.resetButton}
            >
              <MaterialIcons name="restart-alt" size={16} color={Colors.light.textSecondary} /><ThemedText style={styles.resetButtonText}>Reset</ThemedText>
            </TouchableOpacity>
          )}
        </View>

        {/* Filters Grid */}
        <View style={styles.filtersGrid}>
          {/* Category */}
          <View style={styles.filterGroup}>
            <ThemedText style={styles.filterLabel}>Category</ThemedText>
            <TouchableOpacity
              ref={categoryButtonRef}
              style={styles.selectButton}
              onPress={() => openDropdown('category', categoryButtonRef)}
            >
              <ThemedText style={styles.selectValue} numberOfLines={1}>{filters.category || 'All Categories'}</ThemedText>
              <MaterialIcons name="expand-more" size={20} color={Colors.light.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Price Range Trigger */}
          <View style={styles.filterGroup}>
            <ThemedText style={styles.filterLabel}>Price Range</ThemedText>
            <TouchableOpacity
              ref={priceButtonRef}
              style={styles.selectButton}
              onPress={() => openDropdown('price', priceButtonRef)}
            >
              <ThemedText style={styles.selectValue} numberOfLines={1}>{priceDisplayText}</ThemedText>
              <MaterialIcons name="expand-more" size={20} color={Colors.light.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Location */}
          <View style={styles.filterGroup}>
            <ThemedText style={styles.filterLabel}>Location</ThemedText>
            <DesktopLocationPicker
              variant="filter"
              currentLocation={currentLocationSuggestion}
              onLocationSelect={(location) => {
                updateFilters({
                  location: location as any,
                  locationName: location.displayName || location.address?.formatted || location.name,
                  locationLatitude: location.latitude,
                  locationLongitude: location.longitude,
                });
              }}
            />
          </View>

          {/* Sort By */}
          <View style={styles.filterGroup}>
            <ThemedText style={styles.filterLabel}>Sort By</ThemedText>
            <TouchableOpacity
              ref={sortButtonRef}
              style={styles.selectButton}
              onPress={() => openDropdown('sort', sortButtonRef)}
            >
              <ThemedText style={styles.selectValue}>{filters.sortBy}</ThemedText>
              <MaterialIcons name="expand-more" size={20} color={Colors.light.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Dropdown Overlay */}
      <Modal
        visible={activeDropdown !== null}
        transparent
        animationType="none"
        onRequestClose={closeDropdown}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={closeDropdown}
        >
          {dropdownPosition && activeDropdown && (
            <TouchableOpacity
              activeOpacity={1}
              onPress={(e) => Platform.OS === 'web' && e.stopPropagation()}
              style={[
                styles.dropdownModal,
                {
                  left: dropdownPosition.x,
                  top: dropdownPosition.y,
                  width: dropdownPosition.width,
                },
                activeDropdown === 'price' && styles.priceDropdownModal
              ]}
            >
              {activeDropdown === 'price' ? (
                <View style={styles.priceDropdownContent}>
                  <Text style={styles.dropdownHeader}>Price Range</Text>
                  <View style={styles.priceInputColumn}>
                    <View style={styles.priceInputWrapper}>
                      <Text style={styles.priceInputLabel}>Minimum (₹)</Text>
                      <TextInput
                        style={styles.priceInput}
                        value={localPriceMin}
                        onChangeText={(text) => setLocalPriceMin(formatPriceInput(text))}
                        placeholder="0"
                        keyboardType="numeric"
                        autoFocus
                      />
                    </View>
                    <View style={styles.priceInputWrapper}>
                      <Text style={styles.priceInputLabel}>Maximum (₹)</Text>
                      <TextInput
                        style={styles.priceInput}
                        value={localPriceMax}
                        onChangeText={(text) => setLocalPriceMax(formatPriceInput(text))}
                        placeholder="Any"
                        keyboardType="numeric"
                      />
                    </View>
                  </View>
                  <View style={styles.priceDropdownFooter}>
                    <TouchableOpacity onPress={handlePriceReset} style={styles.priceResetButton}>
                      <Text style={styles.priceResetText}>Clear</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={handlePriceApply} style={styles.priceApplyButton}>
                      <Text style={styles.priceApplyText}>Apply</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <ScrollView
                  style={styles.dropdownScrollView}
                  contentContainerStyle={styles.dropdownScrollContent}
                  showsVerticalScrollIndicator
                >
                  {activeDropdown === 'category' && (
                    <>
                      <TouchableOpacity
                        style={styles.dropdownItem}
                        onPress={() => {
                          updateFilters({ category: 'All Categories', categoryId: undefined, subcategoryId: undefined, subcategoryName: undefined });
                          closeDropdown();
                        }}
                      >
                        <ThemedText style={styles.dropdownItemText}>All Categories</ThemedText>{!filters.categoryId && filters.category === 'All Categories' && (
                          <MaterialIcons name="check" size={18} color={Colors.light.primary} />
                        )}
                      </TouchableOpacity>
                      {categories.map((cat) => {
                        const isExpanded = expandedCategories.has(cat.id);
                        const hasSubcategories = cat.subcategories && cat.subcategories.length > 0;

                        return (
                          <View key={cat.id}>
                            <TouchableOpacity
                              style={styles.dropdownItem}
                              onPress={() => {
                                if (hasSubcategories) {
                                  toggleCategoryExpand(cat.id);
                                } else {
                                  updateFilters({ category: cat.name, categoryId: cat.id, subcategoryId: undefined, subcategoryName: undefined });
                                  closeDropdown();
                                }
                              }}
                            >
                              <View style={styles.categoryRow}>
                                {hasSubcategories ? (
                                  <MaterialIcons
                                    name={isExpanded ? 'expand-less' : 'expand-more'}
                                    size={18}
                                    color={Colors.light.textSecondary}
                                  />
                                ) : (
                                  <View style={styles.expandPlaceholder} />
                                )}<ThemedText style={styles.dropdownItemText}>{cat.name}</ThemedText>
                              </View>{filters.categoryId === cat.id && !filters.subcategoryId && (
                                <MaterialIcons name="check" size={18} color={Colors.light.primary} />
                              )}
                            </TouchableOpacity>
                            {isExpanded && hasSubcategories && (
                              <View style={styles.subcategoryList}>
                                <TouchableOpacity
                                  key={`${cat.id}-all`}
                                  style={[styles.dropdownItem, styles.subcategoryItem]}
                                  onPress={() => {
                                    updateFilters({
                                      category: cat.name,
                                      categoryId: cat.id,
                                      subcategoryId: undefined,
                                      subcategoryName: undefined
                                    });
                                    closeDropdown();
                                  }}
                                >
                                  <View style={styles.subcategoryRow}>
                                    <View style={styles.subcategoryIndent} /><ThemedText style={styles.subcategoryItemText}>All {cat.name}</ThemedText>
                                  </View>{filters.categoryId === cat.id && !filters.subcategoryId && (
                                    <MaterialIcons name="check" size={18} color={Colors.light.primary} />
                                  )}
                                </TouchableOpacity>
                                {cat.subcategories!.map((sub) => (
                                  <TouchableOpacity
                                    key={sub.id}
                                    style={[styles.dropdownItem, styles.subcategoryItem]}
                                    onPress={() => {
                                      updateFilters({
                                        category: cat.name,
                                        categoryId: cat.id,
                                        subcategoryId: sub.id,
                                        subcategoryName: sub.name
                                      });
                                      closeDropdown();
                                    }}
                                  >
                                    <View style={styles.subcategoryRow}>
                                      <View style={styles.subcategoryIndent} /><ThemedText style={styles.subcategoryItemText}>{sub.name}</ThemedText>
                                    </View>{filters.subcategoryId === sub.id && (
                                      <MaterialIcons name="check" size={18} color={Colors.light.primary} />
                                    )}
                                  </TouchableOpacity>
                                ))}
                              </View>
                            )}
                          </View>
                        );
                      })}
                    </>
                  )}

                  {activeDropdown === 'sort' && (
                    <>
                      {SORT_OPTIONS.map((option) => (
                        <TouchableOpacity
                          key={option.value}
                          style={styles.dropdownItem}
                          onPress={() => {
                            updateFilters({ sortBy: option.value });
                            closeDropdown();
                          }}
                        >
                          <ThemedText style={styles.dropdownItemText}>{option.label}</ThemedText>{filters.sortBy === option.value && (
                            <MaterialIcons name="check" size={18} color={Colors.light.primary} />
                          )}
                        </TouchableOpacity>
                      ))}
                    </>
                  )}
                </ScrollView>
              )}
            </TouchableOpacity>
          )}
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E8E8E8',
    marginBottom: 20,
    zIndex: 100, // Ensure dropdowns are above items
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  headerSearchContainer: {
    flex: 1,
  },
  headerSearchBarContainer: {
    paddingHorizontal: 0,
    paddingBottom: 0,
  },
  headerSearchBarRow: {
    paddingInline: 0,
  },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: '#F5F5F5',
  },
  resetButtonText: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.light.textSecondary,
  },
  filtersGrid: {
    flexDirection: 'row',
    padding: 20,
    gap: 16,
  },
  filterGroup: {
    flex: 1,
    minWidth: 200,
  },
  filterLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.light.textSecondary,
    marginBottom: 8,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  selectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    paddingHorizontal: 12,
    backgroundColor: '#FAFAFA',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E8E8E8',
    gap: 8,
  },
  selectValue: {
    flex: 1,
    fontSize: 14,
    color: Colors.light.text,
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  dropdownModal: {
    position: 'absolute',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E8E8E8',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 10,
    maxHeight: 300,
    overflow: 'hidden',
  },
  dropdownScrollView: {
    maxHeight: 300,
  },
  dropdownScrollContent: {
    flexGrow: 0,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
    minHeight: 44,
  },
  dropdownItemText: {
    fontSize: 14,
    color: Colors.light.text,
  },
  dropdownHeader: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 16,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  expandPlaceholder: {
    width: 18,
    height: 18,
  },
  subcategoryList: {
    backgroundColor: '#FAFAFA',
  },
  subcategoryItem: {
    paddingLeft: 28,
  },
  subcategoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  subcategoryIndent: {
    width: 18,
    height: 18,
  },
  subcategoryItemText: {
    fontSize: 13,
    color: Colors.light.textSecondary,
  },
  priceDropdownModal: {
    padding: 16,
    maxHeight: 'auto',
  },
  priceDropdownContent: {
    width: '100%',
  },
  priceInputColumn: {
    flexDirection: 'column',
    gap: 12,
    marginBottom: 20,
  },
  priceInputWrapper: {
    width: '100%',
  },
  priceInputLabel: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    marginBottom: 6,
  },
  priceInput: {
    height: 40,
    backgroundColor: '#F5F5F5',
    borderRadius: 6,
    paddingHorizontal: 12,
    fontSize: 14,
    color: Colors.light.text,
    borderWidth: 1,
    borderColor: '#E8E8E8',
    width: '100%',
    ...Platform.select({
      web: {
        outlineStyle: 'none',
      }
    }),
  } as any,
  priceDropdownFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#F5F5F5',
    paddingTop: 16,
  },
  priceResetButton: {
    padding: 8,
  },
  priceResetText: {
    color: Colors.light.textSecondary,
    fontSize: 14,
    fontWeight: '500',
  },
  priceApplyButton: {
    backgroundColor: Colors.light.primary,
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 6,
  },
  priceApplyText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});
