import { StyleSheet, ScrollView, View, Platform, Dimensions, ActivityIndicator } from 'react-native';
import { useState, useEffect } from 'react';
import { MaterialIcons } from '@expo/vector-icons';

import { ThemedText } from '@/components/themed-text';
import { BookingCard } from '@/components/booking-card';
import { formatPrice, shouldHidePrice } from '@/utils/price-formatter';
import { Colors } from '@/constants/theme';
import type { Booking } from '@/types/api.types';

export type BookingContentProps = {
  searchQuery: string;
  bookings: Booking[];
  onBookingPress: (bookingId: number) => void;
  isLoading?: boolean;
};

export function BookingContent({ searchQuery, bookings, onBookingPress, isLoading }: BookingContentProps) {
  const [screenWidth, setScreenWidth] = useState(Dimensions.get('window').width);
  const isDesktop = Platform.OS === 'web' && screenWidth > 768;

  useEffect(() => {
    const onChange = (result: any) => {
      setScreenWidth(result.window.width);
    };

    const dimensionsHandler = Platform.OS === 'web'
      ? Dimensions.addEventListener('change', onChange)
      : null;

    return () => {
      if (dimensionsHandler) {
        dimensionsHandler.remove();
      }
    };
  }, []);

  // Search is now API-based - just display all bookings passed from parent
  const normalized = Array.isArray(bookings) ? bookings : [];

  if (isLoading) {
    return (
      <View style={styles.loadingState}>
        <ActivityIndicator size="large" color={Colors.light.primary} />
        <ThemedText style={styles.loadingText}>Loading bookings...</ThemedText>
      </View>
    );
  }

  if (normalized.length === 0) {
    return (
      <View style={styles.emptyState}>
        <View style={styles.emptyIconContainer}>
          <MaterialIcons name="event-busy" size={64} color={Colors.light.textSecondary} />
        </View>
        <ThemedText style={styles.emptyText}>No bookings found</ThemedText>
        <ThemedText style={styles.emptySubtext}>
          {searchQuery ? 'Try adjusting your search' : "You don't have any bookings yet"}
        </ThemedText>
      </View>
    );
  }

  return (
    <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
      <View style={[styles.bookingList, isDesktop && styles.desktopBookingList]}>
        {normalized.map((booking) => {
          // Use bookingDate if startDate is null
          const displayDate = booking.bookingDate || booking.startDate || booking.createdAt;
          return (
            <BookingCard
              key={booking.id}
              id={typeof booking.id === 'string' ? parseInt(booking.id) : (booking.id as any)}
              service={booking.ad?.title || 'Service'}
              date={displayDate as any}
              time={''}
              status={booking.status as any}
              price={!shouldHidePrice(booking.ad?.price) ? formatPrice(booking.ad?.price) : ''}
              customerName={`${booking.user.firstName} ${booking.user.lastName}`}
              onPress={() => onBookingPress(booking.id as any)}
              containerStyle={isDesktop ? styles.desktopBookingCard : undefined}
              hasComplaint={
                booking.status === 'CONFIRMED' &&
                booking.complaints?.some(c => c.status === 'OPEN' || c.status === 'INVESTIGATING')
              }
            />
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
  },
  bookingList: {
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  desktopBookingList: {
    paddingHorizontal: 0,
    paddingVertical: 24,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 24,
    justifyContent: 'space-between',
  },
  desktopBookingCard: {
    width: '48%',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingVertical: 80,
  },
  emptyIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.light.backgroundSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.light.text,
    textAlign: 'center',
    marginBottom: 10,
  },
  emptySubtext: {
    fontSize: 15,
    color: Colors.light.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  loadingState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: Colors.light.textSecondary,
  },
});
