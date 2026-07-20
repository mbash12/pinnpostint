import React, { useState, useEffect, useCallback, useRef } from 'react';
import { StyleSheet, View, TouchableOpacity, ScrollView, ActivityIndicator, TextInput, RefreshControl, Platform } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { AuthProtection } from '@/components/auth-protection';
import { Footer } from '@/components/footer';
import { DesktopProfileLayout } from '@/components/desktop-profile-layout';
import { Colors, WebShadows } from '@/constants/theme';
import { bookingsService } from '@/services';
import { formatPrice } from '@/utils/price-formatter';
import { useResponsive } from '@/hooks/use-responsive';
import { HEADER_HEIGHT } from '@/constants/layout';
import type { Booking } from '@/types/api.types';

export default function MyBookingsScreen() {
  const router = useRouter();
  const { isDesktop } = useResponsive();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const debounceTimerRef = useRef<any>(null);

  // Debounce search query
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 500);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [searchQuery]);

  const fetchBookings = useCallback(async (pageNum: number = 1, append: boolean = false, query: string = '', isRefresh: boolean = false) => {
    try {
      if (isRefresh) {
        setIsRefreshing(true);
      } else if (pageNum === 1) {
        setIsLoading(true);
      } else {
        setLoadingMore(true);
      }
      const params: { page: number; limit: number; search?: string } = { page: pageNum, limit: 20 };
      if (query && query.trim()) {
        params.search = query.trim();
      }
      const bookingsResp = await bookingsService.getOutgoingBookings(params) as any;
      if (bookingsResp.success && bookingsResp.data) {
        const newData = bookingsResp.data || [];

        if (append) {
          setBookings(prev => [...prev, ...newData]);
        } else {
          setBookings(newData);
        }
        setHasMore(bookingsResp.pagination?.hasNext || false);
        setPage(pageNum);
      }
    } catch (e) {
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
      setLoadingMore(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setPage(1);
      setHasMore(true);
      fetchBookings(1, false, debouncedSearch);
    }, [fetchBookings, debouncedSearch])
  );

  const statusColors: any = {
    'SUBMITTED': '#FF9500',
    'CONFIRMED': '#007AFF',
    'COMPLETED': '#34C759',
    'CANCELLED': '#FF3B30',
    'REJECTED': '#FF3B30',
  };

  const getStatusColor = (status: string) => {
    return statusColors[status] || Colors.light.textSecondary;
  };

  const navigateToBookingDetail = (bookingId: string) => {
    if (bookingId) {
      router.push(`/(pages)/booking-detail?id=${bookingId}`);
    }
  };

  const hasActiveComplaint = (booking: Booking) => {
    return (booking._count?.complaints || 0) > 0 || (booking.complaints && booking.complaints.length > 0);
  };

  const handleSearchChange = (text: string) => {
    setSearchQuery(text);
  };

  const handleSearchSubmit = () => {
    setDebouncedSearch(searchQuery);
  };

  return (
    <AuthProtection>
      <DesktopProfileLayout>
        <ThemedView style={[styles.container, { paddingTop: isDesktop ? 0 : HEADER_HEIGHT }]}>
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={() => fetchBookings(1, false, debouncedSearch, true)}
                colors={[Colors.light.primary]}
                tintColor={Colors.light.primary}
              />
            }
            showsVerticalScrollIndicator={false}
          >
            {/* Header */}
            <View style={styles.header}>
              <ThemedText style={styles.title}>My Bookings</ThemedText>
              <ThemedText style={styles.subtitle}>
                Your service bookings
              </ThemedText>
            </View>

            {/* Search */}
            <View style={styles.searchContainer}>
              <MaterialIcons name="search" size={20} color={Colors.light.textSecondary} style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search bookings..."
                value={searchQuery}
                onChangeText={handleSearchChange}
                onSubmitEditing={handleSearchSubmit}
                returnKeyType="search"
                placeholderTextColor={Colors.light.textSecondary}
              />
            </View>

            {/* Content */}
            {isLoading ? (
              <View style={styles.loadingState}>
                <ThemedText style={styles.loadingText}>Loading bookings...</ThemedText>
              </View>
            ) : bookings.length === 0 ? (
              <View style={styles.emptyState}>
                {searchQuery === '' ? (
                  <>
                    <MaterialIcons name="event" size={64} color={Colors.light.textSecondary} />
                    <ThemedText style={styles.emptyText}>No bookings yet</ThemedText>
                    <ThemedText style={styles.emptySubtext}>
                      Book services you need from the browse section
                    </ThemedText>
                  </>
                ) : (
                  <>
                    <MaterialIcons name="search-off" size={64} color={Colors.light.textSecondary} />
                    <ThemedText style={styles.emptyText}>No bookings found</ThemedText>
                    <ThemedText style={styles.emptySubtext}>
                      Try a different search term
                    </ThemedText>
                  </>
                )}
              </View>
            ) : (
              <>
                {bookings.map((booking) => (
                  <TouchableOpacity
                    key={booking.id}
                    style={styles.bookingCard}
                    onPress={() => navigateToBookingDetail(booking.id)}
                  >
                    <View style={styles.bookingHeader}>
                      <View style={styles.bookingInfo}>
                        <View style={styles.bookingTitleRow}>
                          <MaterialIcons
                            name="event"
                            size={16}
                            color="#007AFF"
                          />
                          <ThemedText style={styles.bookingTitle}>{booking.ad?.title || 'Booking'}</ThemedText>
                          {hasActiveComplaint(booking) && (
                            <View style={[styles.complaintBadge, { backgroundColor: '#FF3B30' }]}>
                              <MaterialIcons name="error" size={12} color="#FFFFFF" />
                              <ThemedText style={styles.complaintBadgeText}>Complaint</ThemedText>
                            </View>
                          )}
                        </View>
                        <View style={styles.bookingMeta}>
                          {booking.ad?.category?.name ? (
                            <ThemedText style={styles.bookingCategory}>{booking.ad.category.name}</ThemedText>
                          ) : null}
                        </View>
                      </View>
                      <View style={styles.statusContainer}>
                        <ThemedText style={[styles.statusText, { color: getStatusColor(booking.status) }]}>
                          {booking.status}
                        </ThemedText>
                      </View>
                    </View>

                    <View style={styles.bookingDetails}>
                      <View style={styles.bookingStats}>
                        {booking.ad?.price ? <ThemedText style={styles.bookingPrice}>{formatPrice(booking.ad.price)}</ThemedText> : null}
                        <ThemedText style={styles.bookingDate}>
                          {booking.bookingDate || booking.startDate ? (
                            <>
                              {new Date(booking.bookingDate || booking.startDate!).toLocaleDateString()}
                              {booking.slotId && booking.ad?.slots?.find((s: any) => s.id === booking.slotId) && (
                                <> at {(booking.ad.slots.find((s: any) => s.id === booking.slotId) as any).startTime}</>
                              )}
                              {!booking.slotId && (booking.bookingDate || booking.startDate) && (
                                <> at {new Date(booking.bookingDate || booking.startDate!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</>
                              )}
                            </>
                          ) : (
                            <>
                              {new Date(booking.createdAt).toLocaleDateString()} at{' '}
                              {new Date(booking.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </>
                          )}
                        </ThemedText>
                      </View>
                      <TouchableOpacity
                        style={styles.actionButton}
                        onPress={() => navigateToBookingDetail(booking.id)}
                      >
                        <MaterialIcons name="arrow-forward" size={20} color={Colors.light.primary} />
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                ))}
              </>
            )}

            {loadingMore && (
              <View style={styles.loadingMore}>
                <ActivityIndicator size="small" color={Colors.light.primary} />
              </View>
            )}

            {!isDesktop && <Footer />}
          </ScrollView>
        </ThemedView>
      </DesktopProfileLayout>
    </AuthProtection>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 0,
    paddingBottom: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.light.textSecondary,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    paddingHorizontal: 12,
    marginHorizontal: 16,
    marginBottom: 20,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: Colors.light.text,
    borderWidth: 0,
    ...(Platform.OS === 'web' ? ({
      outlineWidth: 0,
      outlineColor: 'transparent',
      outlineStyle: 'none',
    } as any) : {}),
  },
  bookingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    marginHorizontal: 16,
    boxShadow: WebShadows.soft,
    elevation: 1,
  },
  bookingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  bookingInfo: {
    flex: 1,
  },
  bookingTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  bookingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
    marginLeft: 6,
    flex: 1,
  },
  bookingMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bookingCategory: {
    fontSize: 12,
    color: Colors.light.textSecondary,
  },
  statusContainer: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#F0F0F0',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
  },
  bookingDetails: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bookingStats: {
    flex: 1,
  },
  bookingPrice: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 4,
  },
  bookingDate: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    marginBottom: 2,
  },
  actionButton: {
    padding: 8,
    borderRadius: 16,
    backgroundColor: '#F0F0F0',
  },
  complaintBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    gap: 3,
    marginLeft: 8,
  },
  complaintBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    marginTop: 4,
    textAlign: 'center',
  },
  loadingState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
    paddingHorizontal: 40,
  },
  loadingText: {
    fontSize: 16,
    color: Colors.light.textSecondary,
    textAlign: 'center',
    marginTop: 12,
  },
  loadingMore: {
    paddingVertical: 20,
    alignItems: 'center',
  },
});
