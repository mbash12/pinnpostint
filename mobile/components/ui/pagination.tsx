/**
 * Pagination Components
 * Reusable pagination components for mobile app
 */

import React from 'react';
import { View, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import { PaginationMeta } from '@/services/pagination.service';

export interface PaginationControlsProps {
  pagination: PaginationMeta;
  onPageChange: (page: number) => void;
  loading?: boolean;
  showInfo?: boolean;
}

/**
 * Pagination Controls with Previous/Next and current page display
 */
export function PaginationControls({
  pagination,
  onPageChange,
  loading = false,
  showInfo = true,
}: PaginationControlsProps) {
  const handlePrevious = () => {
    if (pagination.hasPreviousPage && !loading) {
      onPageChange(pagination.page - 1);
    }
  };

  const handleNext = () => {
    if (pagination.hasNextPage && !loading) {
      onPageChange(pagination.page + 1);
    }
  };

  return (
    <View style={styles.paginationContainer}>
      <View style={styles.paginationControls}>
        <TouchableOpacity
          style={[
            styles.paginationButton,
            (!pagination.hasPreviousPage || loading) && styles.paginationButtonDisabled,
          ]}
          onPress={handlePrevious}
          disabled={!pagination.hasPreviousPage || loading}
          activeOpacity={0.7}
        >
          <MaterialIcons
            name="chevron-left"
            size={20}
            color={
              !pagination.hasPreviousPage || loading
                ? Colors.light.textSecondary
                : Colors.light.background
            }
          />
          <ThemedText
            style={[
              styles.paginationButtonText,
              (!pagination.hasPreviousPage || loading) && styles.paginationButtonTextDisabled,
            ]}
          >
            Previous
          </ThemedText>
        </TouchableOpacity>

        <View style={styles.pageInfo}>
          <ThemedText style={styles.pageInfoText}>
            Page {pagination.page} of {pagination.totalPages}
          </ThemedText>
        </View>

        <TouchableOpacity
          style={[
            styles.paginationButton,
            (!pagination.hasNextPage || loading) && styles.paginationButtonDisabled,
          ]}
          onPress={handleNext}
          disabled={!pagination.hasNextPage || loading}
          activeOpacity={0.7}
        >
          <ThemedText
            style={[
              styles.paginationButtonText,
              (!pagination.hasNextPage || loading) && styles.paginationButtonTextDisabled,
            ]}
          >
            Next
          </ThemedText>
          <MaterialIcons
            name="chevron-right"
            size={20}
            color={
              !pagination.hasNextPage || loading
                ? Colors.light.textSecondary
                : Colors.light.background
            }
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}

export interface LoadMoreButtonProps {
  hasNextPage: boolean;
  loading: boolean;
  onLoadMore: () => void;
  text?: string;
  loadingText?: string;
}

/**
 * Load more button for infinite scroll
 */
export function LoadMoreButton({
  hasNextPage,
  loading,
  onLoadMore,
  text = 'Load More',
  loadingText = 'Loading...',
}: LoadMoreButtonProps) {
  if (!hasNextPage) {
    return (
      <View style={styles.endOfListContainer}>
        <ThemedText style={styles.endOfListText}>No more items to load</ThemedText>
      </View>
    );
  }

  return (
    <View style={styles.loadMoreContainer}>
      <TouchableOpacity
        style={[styles.loadMoreButton, loading && styles.loadMoreButtonDisabled]}
        onPress={onLoadMore}
        disabled={loading}
      >
        {loading && <ActivityIndicator size="small" color={Colors.light.primary} />}
        <ThemedText style={styles.loadMoreText}>
          {loading ? loadingText : text}
        </ThemedText>
      </TouchableOpacity>
    </View>
  );
}

export interface PaginationInfoProps {
  pagination: PaginationMeta;
  itemName?: string;
}

/**
 * Pagination information display
 */
export function PaginationInfo({ pagination, itemName = 'items' }: PaginationInfoProps) {
  const start = (pagination.page - 1) * pagination.limit + 1;
  const end = Math.min(pagination.page * pagination.limit, pagination.total);

  return (
    <View style={styles.infoContainer}>
      <ThemedText style={styles.infoText}>
        Showing {start}-{end} of {pagination.total} {itemName}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  paginationContainer: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
    backgroundColor: Colors.light.background,
  },
  paginationControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  paginationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: Colors.light.primary,
    gap: 4,
    flex: 1,
    justifyContent: 'center',
  },
  paginationButtonDisabled: {
    backgroundColor: Colors.light.backgroundSecondary,
    opacity: 0.6,
  },
  paginationButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.background,
  },
  paginationButtonTextDisabled: {
    color: Colors.light.textSecondary,
  },
  pageInfo: {
    paddingHorizontal: 12,
    alignItems: 'center',
    minWidth: 120,
  },
  pageInfoText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.light.textSecondary,
    textAlign: 'center',
  },
  loadMoreContainer: {
    paddingVertical: 20,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  loadMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    backgroundColor: Colors.light.primary,
    minWidth: 120,
    justifyContent: 'center',
  },
  loadMoreButtonDisabled: {
    opacity: 0.7,
  },
  loadMoreText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.background,
    marginLeft: 8,
  },
  endOfListContainer: {
    paddingVertical: 20,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  endOfListText: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    fontStyle: 'italic',
  },
  infoContainer: {
    paddingVertical: 8,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  infoText: {
    fontSize: 12,
    color: Colors.light.textSecondary,
  },
});