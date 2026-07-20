import React, { useState, useEffect } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { BaseBottomSheet } from '@/components/ui/base-bottom-sheet';
import { Colors } from '@/constants/theme';
import { ThemedText } from '@/components/themed-text';
import { categoriesService } from '@/services/categories.service';

export interface MyAdsFilterOptions {
  // Ad Status filters
  adStatus: 'all' | 'active' | 'review' | 'expired' | 'rejected';
  // Booking Status filters
  bookingStatus: 'all' | 'pending' | 'confirmed' | 'completed' | 'cancelled';
  // Category filter
  category: string;
  categoryId?: string;
  // Date range filter
  dateRange: 'all' | 'today' | 'week' | 'month' | 'year';
  // Sort options
  sortBy: 'newest' | 'oldest' | 'price-high' | 'price-low' | 'name';
}

const defaultFilters: MyAdsFilterOptions = {
  adStatus: 'all',
  bookingStatus: 'all',
  category: 'All Categories',
  dateRange: 'all',
  sortBy: 'newest',
};

interface MyAdsFilterBottomSheetProps {
  visible: boolean;
  onClose: () => void;
  onApply: (filters: MyAdsFilterOptions) => void;
  onReset: () => void;
  filters: MyAdsFilterOptions;
  activeTab: 'ads' | 'booking';
}

export function MyAdsFilterBottomSheet({
  visible,
  onClose,
  onApply,
  onReset,
  filters,
  activeTab,
}: MyAdsFilterBottomSheetProps) {
  const [localFilters, setLocalFilters] = useState<MyAdsFilterOptions>(filters);
  const [categories, setCategories] = useState<any[]>([]);

  useEffect(() => {
    if (visible) {
      setLocalFilters(filters);
      fetchCategories();
    }
  }, [visible]);

  const fetchCategories = async () => {
    try {
      const resp = await categoriesService.getCategories();
      if (resp.success && resp.data) {
        setCategories(resp.data || []);
      }
    } catch (e) {
    }
  };

  const handleApply = () => {
    onApply(localFilters);
    onClose();
  };

  const handleReset = () => {
    setLocalFilters(defaultFilters);
    onReset();
    onClose();
  };

  const adStatusOptions = [
    { id: 'all', label: 'All Status', icon: 'apps' },
    { id: 'active', label: 'Active', icon: 'check-circle' },
    { id: 'review', label: 'Review', icon: 'schedule' },
    { id: 'expired', label: 'Expired', icon: 'history' },
    { id: 'rejected', label: 'Rejected', icon: 'cancel' },
  ];

  const bookingStatusOptions = [
    { id: 'all', label: 'All Status', icon: 'apps' },
    { id: 'pending', label: 'Pending', icon: 'schedule' },
    { id: 'confirmed', label: 'Confirmed', icon: 'check-circle' },
    { id: 'completed', label: 'Completed', icon: 'done-all' },
    { id: 'cancelled', label: 'Cancelled', icon: 'cancel' },
  ];

  const dateRangeOptions = [
    { id: 'all', label: 'All Time' },
    { id: 'today', label: 'Today' },
    { id: 'week', label: 'This Week' },
    { id: 'month', label: 'This Month' },
    { id: 'year', label: 'This Year' },
  ];

  const sortOptions = [
    { id: 'newest', label: 'Newest First' },
    { id: 'oldest', label: 'Oldest First' },
    { id: 'price-high', label: 'Price: High to Low' },
    { id: 'price-low', label: 'Price: Low to High' },
    { id: 'name', label: 'Name: A to Z' },
  ];

  const renderStatusFilter = () => {
    const options = activeTab === 'ads' ? adStatusOptions : bookingStatusOptions;
    const filterKey = activeTab === 'ads' ? 'adStatus' : 'bookingStatus';
    const currentStatus = localFilters[filterKey];

    return (
      <View style={styles.filterSection}>
        <ThemedText style={styles.filterSectionTitle}>Status</ThemedText>
        <View style={styles.optionsGrid}>
          {options.map((option) => (
            <TouchableOpacity
              key={option.id}
              style={[
                styles.optionChip,
                currentStatus === option.id && styles.optionChipActive,
              ]}
              onPress={() =>
                setLocalFilters({ ...localFilters, [filterKey]: option.id as any })
              }
            >
              <MaterialIcons
                name={option.icon as any}
                size={16}
                color={currentStatus === option.id ? Colors.light.primary : Colors.light.textSecondary}
              />
              <ThemedText
                style={[
                  styles.optionChipText,
                  currentStatus === option.id && styles.optionChipTextActive,
                ]}
              >
                {option.label}
              </ThemedText>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  };

  const renderCategoryFilter = () => {
    return (
      <View style={styles.filterSection}>
        <ThemedText style={styles.filterSectionTitle}>Category</ThemedText>
        <View style={styles.categoryGrid}>
          <TouchableOpacity
            style={[
              styles.categoryChip,
              localFilters.category === 'All Categories' && styles.categoryChipActive,
            ]}
            onPress={() =>
              setLocalFilters({
                ...localFilters,
                category: 'All Categories',
                categoryId: undefined,
              })
            }
          >
            <ThemedText
              style={[
                styles.categoryChipText,
                localFilters.category === 'All Categories' && styles.categoryChipTextActive,
              ]}
            >
              All Categories
            </ThemedText>
          </TouchableOpacity>
          {categories.slice(0, 8).map((cat) => (
            <TouchableOpacity
              key={cat.id}
              style={[
                styles.categoryChip,
                localFilters.categoryId === cat.id && styles.categoryChipActive,
              ]}
              onPress={() =>
                setLocalFilters({
                  ...localFilters,
                  category: cat.name,
                  categoryId: cat.id,
                })
              }
            >
              <ThemedText
                style={[
                  styles.categoryChipText,
                  localFilters.categoryId === cat.id && styles.categoryChipTextActive,
                ]}
              >
                {cat.name}
              </ThemedText>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  };

  const renderDateRangeFilter = () => {
    return (
      <View style={styles.filterSection}>
        <ThemedText style={styles.filterSectionTitle}>Date Posted</ThemedText>
        <View style={styles.optionsGrid}>
          {dateRangeOptions.map((option) => (
            <TouchableOpacity
              key={option.id}
              style={[
                styles.optionChip,
                localFilters.dateRange === option.id && styles.optionChipActive,
              ]}
              onPress={() =>
                setLocalFilters({ ...localFilters, dateRange: option.id as any })
              }
            >
              <ThemedText
                style={[
                  styles.optionChipText,
                  localFilters.dateRange === option.id && styles.optionChipTextActive,
                ]}
              >
                {option.label}
              </ThemedText>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  };

  const renderSortFilter = () => {
    return (
      <View style={styles.filterSection}>
        <ThemedText style={styles.filterSectionTitle}>Sort By</ThemedText>
        <View style={styles.sortOptions}>
          {sortOptions.map((option) => (
            <TouchableOpacity
              key={option.id}
              style={[
                styles.sortOption,
                localFilters.sortBy === option.id && styles.sortOptionActive,
              ]}
              onPress={() =>
                setLocalFilters({ ...localFilters, sortBy: option.id as any })
              }
            >
              <MaterialIcons
                name={
                  localFilters.sortBy === option.id
                    ? 'radio-button-checked'
                    : 'radio-button-unchecked'
                }
                size={20}
                color={localFilters.sortBy === option.id ? Colors.light.primary : Colors.light.textSecondary}
              />
              <ThemedText
                style={[
                  styles.sortOptionText,
                  localFilters.sortBy === option.id && styles.sortOptionTextActive,
                ]}
              >
                {option.label}
              </ThemedText>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  };

  const renderFilterButton = (onPress: () => void, text: string, isPrimary: boolean) => (
    <TouchableOpacity
      style={[styles.actionButton, isPrimary ? styles.primaryButton : styles.secondaryButton]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <ThemedText style={[styles.actionButtonText, isPrimary && styles.primaryButtonText]}>
        {text}
      </ThemedText>
    </TouchableOpacity>
  );

  return (
    <BaseBottomSheet
      visible={visible}
      onClose={onClose}
      title="Filter My Ads"
      backdropOpacity={0.3}
    >
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {renderStatusFilter()}
        {activeTab === 'ads' && renderCategoryFilter()}
        {renderDateRangeFilter()}
        {renderSortFilter()}

        <View style={styles.actionsContainer}>
          {renderFilterButton(handleReset, 'Reset All', false)}
          {renderFilterButton(handleApply, 'Apply Filters', true)}
        </View>
      </ScrollView>
    </BaseBottomSheet>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  filterSection: {
    marginBottom: 24,
  },
  filterSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 12,
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.light.backgroundSecondary,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  optionChipActive: {
    backgroundColor: Colors.light.primaryLight,
    borderColor: Colors.light.primary,
  },
  optionChipText: {
    fontSize: 14,
    color: Colors.light.text,
    fontWeight: '500',
  },
  optionChipTextActive: {
    color: Colors.light.primary,
    fontWeight: '600',
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: Colors.light.backgroundSecondary,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  categoryChipActive: {
    backgroundColor: Colors.light.primaryLight,
    borderColor: Colors.light.primary,
  },
  categoryChipText: {
    fontSize: 13,
    color: Colors.light.text,
    fontWeight: '500',
  },
  categoryChipTextActive: {
    color: Colors.light.primary,
    fontWeight: '600',
  },
  sortOptions: {
    gap: 4,
  },
  sortOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  sortOptionActive: {
    backgroundColor: Colors.light.primaryLight,
  },
  sortOptionText: {
    flex: 1,
    fontSize: 15,
    color: Colors.light.text,
    fontWeight: '500',
  },
  sortOptionTextActive: {
    color: Colors.light.primary,
    fontWeight: '600',
  },
  actionsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
    marginBottom: 24,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButton: {
    backgroundColor: Colors.light.primary,
  },
  secondaryButton: {
    backgroundColor: Colors.light.backgroundSecondary,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
  },
  primaryButtonText: {
    color: '#FFFFFF',
  },
});
