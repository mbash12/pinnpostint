import { StyleSheet, TouchableOpacity, View, Platform } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import { getBookingStatusConfig } from '@/constants/status-config';
import { shouldHidePrice } from '@/utils/price-formatter';

const formatDate = (dateString: string): string => {
  try {
    const date = new Date(dateString);
    const options: Intl.DateTimeFormatOptions = {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    };
    return date.toLocaleDateString('en-US', options);
  } catch {
    return dateString;
  }
};

export type BookingCardProps = {
  id: number;
  service: string;
  date: string;
  time: string;
  status: 'Confirmed' | 'Pending' | 'Completed' | 'Cancelled' | 'Cancelled By Owner';
  price: string;
  onPress: (id: number) => void;
  containerStyle?: object;
  customerName?: string;
  hasComplaint?: boolean;
};

export function BookingCard({
  id,
  service,
  date,
  time,
  status,
  price,
  onPress,
  containerStyle,
  customerName,
  hasComplaint = false,
}: BookingCardProps) {
  const statusConfig = getBookingStatusConfig(status);

  return (
    <TouchableOpacity
      style={[styles.bookingCard, hasComplaint && styles.bookingCardWithComplaint, containerStyle]}
      onPress={() => onPress(id)}
      activeOpacity={0.7}
    >
      <View style={styles.cardTop}>
        <View style={styles.leftSection}>
          <View style={styles.iconContainer}>
            <MaterialIcons name="calendar-month" size={24} color={Colors.light.primary} />
          </View>
          <View style={styles.serviceInfo}>
            <ThemedText style={styles.bookingService} numberOfLines={1}>{service}</ThemedText>
            <ThemedText style={styles.bookingSubtext}>
              {customerName ? `by ${customerName}` : `#${id.toString().slice(-6)}`}
            </ThemedText>
          </View>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: statusConfig.backgroundColor }]}>
          <MaterialIcons name={statusConfig.icon} size={14} color={statusConfig.textColor} />
          <ThemedText style={[styles.statusText, { color: statusConfig.textColor }]}>{status}</ThemedText>
        </View>
      </View>

      <View style={styles.divider} />

      <View style={styles.cardBottom}>
        <View style={styles.leftSectionBottom}>
          <View style={styles.dateRow}>
            <View style={styles.infoItem}>
              <MaterialIcons name="event" size={16} color={Colors.light.textSecondary} />
              <ThemedText style={styles.infoText}>{formatDate(date)}</ThemedText>
            </View>
            {time && (
              <View style={styles.infoItem}>
                <MaterialIcons name="access-time" size={16} color={Colors.light.textSecondary} />
                <ThemedText style={styles.infoText}>{time}</ThemedText>
              </View>
            )}
          </View>
          {hasComplaint && (
            <View style={styles.complaintBadge}>
              <MaterialIcons name="error-outline" size={12} color="#FFFFFF" />
              <ThemedText style={styles.complaintBadgeText}>Issue</ThemedText>
            </View>
          )}
        </View>
        {!shouldHidePrice(price) && (
          <View style={styles.priceSection}>
            <ThemedText style={styles.priceLabel}>Amount</ThemedText>
            <ThemedText style={styles.bookingPrice}>{price}</ThemedText>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  bookingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#F0F0F0',
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
      },
      android: {
        elevation: 2,
      },
      web: {
        boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.04)',
        transition: 'box-shadow 0.2s ease',
      },
    }),
  },
  bookingCardWithComplaint: {
    borderColor: Colors.light.primary,
    borderWidth: 1.5,
    backgroundColor: '#FFFBFB',
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 16,
    paddingBottom: 12,
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
    gap: 12,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: Colors.light.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  serviceInfo: {
    flex: 1,
  },
  bookingService: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.light.text,
    flex: 1,
  },
  bookingSubtext: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    lineHeight: 18,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  divider: {
    height: 1,
    backgroundColor: '#F5F5F5',
    marginHorizontal: 16,
  },
  cardBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FAFAFA',
  },
  leftSectionBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  infoText: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    fontWeight: '500',
  },
  priceSection: {
    alignItems: 'flex-end',
    gap: 2,
  },
  priceLabel: {
    fontSize: 11,
    color: Colors.light.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  bookingPrice: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.light.primary,
    letterSpacing: -0.5,
  },
  complaintBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    backgroundColor: '#FF3B30',
    gap: 3,
  },
  complaintBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
});