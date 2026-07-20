import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Platform, Dimensions, ActivityIndicator, Text } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { adsService, bookingsService, platformAdsService } from '@/services';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { AuthProtection } from '@/components/auth-protection';
import { Footer } from '@/components/footer';
import { MobilePlatformBanners } from '@/components/mobile-platform-banners';
import { Colors, Shadows } from '@/constants/theme';
import { HEADER_HEIGHT } from '@/constants/layout';
import { getBookingStatusConfig } from '@/constants/status-config';
import { useBackNavigation, FALLBACK_ROUTES } from '@/utils/navigation-helpers';
import type { PlatformAd } from '@/types/api.types';
import { PlatformAdPosition } from '@/types/api.types';
import { SideBanners } from '@/components/home/side-banners';

export default function AdBookingsPage() {
  const router = useRouter();
  const { goBack } = useBackNavigation(FALLBACK_ROUTES.AD_BOOKINGS);
  const params = useLocalSearchParams();
  
  const [ad, setAd] = useState<any>(null);
  const [bookings, setBookings] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [screenWidth, setScreenWidth] = useState(Dimensions.get('window').width);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [platformAds, setPlatformAds] = useState<PlatformAd[]>([]);
  const [isLoadingPlatformAds, setIsLoadingPlatformAds] = useState(true);

  const isDesktop = Platform.OS === 'web' && screenWidth > 768;

  useEffect(() => {
    const onChange = (result: any) => {
      setScreenWidth(result.window.width);
    };
    const dimensionsHandler = Platform.OS === 'web' ? Dimensions.addEventListener('change', onChange) : null;
    return () => dimensionsHandler?.remove();
  }, []);

  useEffect(() => {
    const fetchPlatformAds = async () => {
      try {
        setIsLoadingPlatformAds(true);
        const response = await platformAdsService.getPlatformAds();
        if (response.success && response.data) {
          setPlatformAds(response.data);
        }
      } catch (error) {
      } finally {
        setIsLoadingPlatformAds(false);
      }
    };
    fetchPlatformAds();
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      if (params.adId) {
        try {
          const [adResponse, bookingsResponse] = await Promise.all([
            adsService.getMyAd(params.adId as string),
            bookingsService.getAdBookings(params.adId as string)
          ]);
          
          
          if (adResponse.success && adResponse.data) {
            setAd(adResponse.data);
          }
          
          if (bookingsResponse.success && bookingsResponse.data) {
            setBookings(bookingsResponse.data);
          }
        } catch (error) {
        } finally {
          setIsLoading(false);
        }
      }
    };
    fetchData();
  }, [params.adId]);

  const filteredBookings = filterStatus === 'all' 
    ? bookings 
    : bookings.filter(b => b.status === filterStatus);

  const stats = {
    total: bookings.length,
    pending: bookings.filter(b => b.status === 'SUBMITTED').length,
    confirmed: bookings.filter(b => b.status === 'CONFIRMED').length,
    completed: bookings.filter(b => b.status === 'COMPLETED').length,
    cancelled: bookings.filter(b => b.status === 'CANCELLED').length,
    rejected: bookings.filter(b => b.status === 'REJECTED').length,
  };

  if (isLoading) {
    return (
      <AuthProtection>
        <ThemedView style={styles.container}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.light.primary} />
            <ThemedText style={styles.loadingText}>Loading bookings...</ThemedText>
          </View>
        </ThemedView>
      </AuthProtection>
    );
  }

  return (
    <AuthProtection>
      <ThemedView style={styles.container}>
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {!isDesktop && <MobilePlatformBanners ads={platformAds} position="top" style={{ marginVertical: 8, paddingHorizontal: 16 }} />}
          <View style={isDesktop ? styles.desktopLayout : styles.content}>
            {isDesktop && (
              <SideBanners
                ads={platformAds.filter(ad => ad.position === PlatformAdPosition.LEFT)}
                position={PlatformAdPosition.LEFT}
              />
            )}

            <View style={isDesktop && styles.mainContent}>
              {/* Header */}
              <View style={[styles.header, isDesktop && styles.desktopHeader]}>
                <TouchableOpacity onPress={goBack} style={styles.backButton}>
                  <MaterialIcons name="arrow-back" size={24} color={Colors.light.text} />
                </TouchableOpacity>
                <View style={styles.headerContent}>
                  <ThemedText style={[styles.headerTitle, isDesktop && styles.desktopHeaderTitle]}>
                    Bookings
                  </ThemedText>
                  {ad && <ThemedText style={styles.headerSubtitle}>{ad.title}</ThemedText>}
                </View>
              </View>

              {/* Filter Tabs */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.filterContainer}
                contentContainerStyle={styles.filterContent}
              >
                {[
                  { id: 'all', label: 'All', count: stats.total },
                  { id: 'SUBMITTED', label: 'Pending', count: stats.pending },
                  { id: 'CONFIRMED', label: 'Confirmed', count: stats.confirmed },
                  { id: 'COMPLETED', label: 'Completed', count: stats.completed },
                  { id: 'CANCELLED', label: 'Cancelled', count: stats.cancelled },
                  { id: 'REJECTED', label: 'Rejected', count: stats.rejected },
                ].map((tab) => (
                  <TouchableOpacity
                    key={tab.id}
                    style={[
                      styles.filterTab,
                      isDesktop && styles.desktopFilterTab,
                      filterStatus === tab.id && styles.filterTabActive
                    ]}
                    onPress={() => setFilterStatus(tab.id)}
                  >
                    <ThemedText style={[
                      styles.filterTabText,
                      filterStatus === tab.id && styles.filterTabTextActive
                    ]}>
                      {tab.label} ({tab.count})
                    </ThemedText>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Bookings List */}
              {filteredBookings.length === 0 ? (
                <View style={styles.emptyState}>
                  <View style={styles.emptyIconContainer}>
                    <MaterialIcons name="event-busy" size={64} color={Colors.light.textSecondary} />
                  </View>
                  <ThemedText style={styles.emptyText}>
                    {filterStatus === 'all' ? 'No bookings yet' : `No ${filterStatus.toLowerCase()} bookings`}
                  </ThemedText>
                  <ThemedText style={styles.emptySubtext}>
                    {filterStatus === 'all'
                      ? 'Bookings for this service will appear here'
                      : 'Try selecting a different filter'}
                  </ThemedText>
                </View>
              ) : (
                <View style={[styles.bookingsGrid, isDesktop && styles.desktopBookingsGrid]}>
                  {filteredBookings.map((booking) => {
                    const statusConfigStandard = getBookingStatusConfig(booking.status);
                    return (
                      <TouchableOpacity
                        key={booking.id}
                        style={[styles.bookingCard, isDesktop && styles.desktopBookingCard]}
                        onPress={() => {
                          router.push(`/ad-booking-detail?id=${booking.id}`);
                        }}
                        activeOpacity={0.7}
                      >
                        <View style={styles.bookingCardHeader}>
                          <View style={[styles.statusBadge, { backgroundColor: statusConfigStandard.backgroundColor }]}>
                            <MaterialIcons name={statusConfigStandard.icon} size={14} color={statusConfigStandard.textColor} />
                            <Text style={[styles.statusText, { color: statusConfigStandard.textColor }]}>
                              {statusConfigStandard.label || booking.status}
                            </Text>
                          </View>
                          <MaterialIcons name="chevron-right" size={20} color={Colors.light.textSecondary} />
                        </View>

                        <View style={styles.bookingCardBody}>
                          <View style={styles.infoRow}>
                            <View style={styles.iconCircle}>
                              <MaterialIcons name="person" size={18} color={Colors.light.primary} />
                            </View>
                            <View style={styles.infoContent}>
                              <ThemedText style={styles.infoLabel}>Customer</ThemedText>
                              <ThemedText style={styles.infoValue}>
                                {booking.user?.firstName} {booking.user?.lastName}
                              </ThemedText>
                            </View>
                          </View>

                          <View style={styles.infoRow}>
                            <View style={styles.iconCircle}>
                              <MaterialIcons name="calendar-today" size={18} color={Colors.light.primary} />
                            </View>
                            <View style={styles.infoContent}>
                              <ThemedText style={styles.infoLabel}>Date & Time</ThemedText>
                              {booking.bookingDate || booking.startDate ? (
                                <>
                                  <ThemedText style={styles.infoValue}>
                                    {new Date(booking.bookingDate || booking.startDate!).toLocaleDateString('en-US', {
                                      month: 'short', day: 'numeric', year: 'numeric'
                                    })}
                                  </ThemedText>
                                  {booking.slotId && (booking.ad?.slots || ad?.slots)?.find((s: any) => s.id === booking.slotId) && (
                                    <ThemedText style={styles.infoTime}>
                                      {((booking.ad?.slots || ad?.slots)?.find((s: any) => s.id === booking.slotId) as any).startTime} - {((booking.ad?.slots || ad?.slots)?.find((s: any) => s.id === booking.slotId) as any).endTime}
                                    </ThemedText>
                                  )}
                                  {!booking.slotId && (booking.bookingDate || booking.startDate) && (
                                    <ThemedText style={styles.infoTime}>
                                      {new Date(booking.bookingDate || booking.startDate!).toLocaleTimeString([], {
                                        hour: '2-digit', minute: '2-digit'
                                      })}
                                    </ThemedText>
                                  )}
                                </>
                              ) : (
                                <>
                                  <ThemedText style={styles.infoValue}>
                                    {new Date(booking.createdAt).toLocaleDateString('en-US', {
                                      month: 'short', day: 'numeric', year: 'numeric'
                                    })}
                                  </ThemedText>
                                  <ThemedText style={styles.infoTime}>
                                    {new Date(booking.createdAt).toLocaleTimeString([], {
                                      hour: '2-digit', minute: '2-digit'
                                    })}
                                  </ThemedText>
                                </>
                              )}
                            </View>
                          </View>

                          {booking.user?.phone && (
                            <View style={styles.infoRow}>
                              <View style={styles.iconCircle}>
                                <MaterialIcons name="phone" size={18} color={Colors.light.primary} />
                              </View>
                              <View style={styles.infoContent}>
                                <ThemedText style={styles.infoLabel}>Contact</ThemedText>
                                <ThemedText style={styles.infoValue}>{booking.user.phone}</ThemedText>
                              </View>
                            </View>
                          )}

                          {booking.notes && (
                            <View style={styles.notesContainer}>
                              <MaterialIcons name="notes" size={16} color={Colors.light.textSecondary} />
                              <ThemedText style={styles.notesText} numberOfLines={2}>
                                {booking.notes}
                              </ThemedText>
                            </View>
                          )}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>

            {isDesktop && (
              <SideBanners
                ads={platformAds.filter(ad => ad.position === PlatformAdPosition.RIGHT)}
                position={PlatformAdPosition.RIGHT}
              />
            )}
          </View>
          {!isDesktop && <MobilePlatformBanners ads={platformAds} position="bottom" />}
          <Footer />
        </ScrollView>
      </ThemedView>
    </AuthProtection>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingTop: HEADER_HEIGHT,
    paddingBottom: 20,
    paddingHorizontal: 16,
  },
  desktopLayout: {
    flexDirection: 'row',
    gap: 24,
    maxWidth: 1400,
    width: '100%',
    alignSelf: 'center',
    paddingTop: 40,
    paddingBottom: 20,
    paddingHorizontal: 24,
  },
  mainContent: {
    flex: 1,
    minWidth: 0,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: Colors.light.textSecondary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.card,
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 24,
    ...Shadows.soft,
  },
  desktopHeader: {
    padding: 20,
    borderRadius: 16,
    marginBottom: 24,
  },
  backButton: {
    marginRight: 16,
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#EBEBEB',
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.light.text,
  },
  desktopHeaderTitle: {
    fontSize: 24,
  },
  headerSubtitle: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  filterContainer: {
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  filterContent: {
    gap: 8,
  },
  filterTab: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: Colors.light.card,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  desktopFilterTab: {
    paddingHorizontal: 50,
  },
  filterTabActive: {
    backgroundColor: Colors.light.primary,
    borderColor: Colors.light.primary,
  },
  filterTabText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.text,
  },
  filterTabTextActive: {
    color: '#FFFFFF',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    backgroundColor: Colors.light.card,
    borderRadius: 16,
    marginTop: 20,
  },
  emptyIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.light.text,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  bookingsGrid: {
    gap: 12,
  },
  desktopBookingsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 20,
  },
  bookingCard: {
    backgroundColor: Colors.light.card,
    borderRadius: 12,
    padding: 16,
    ...Shadows.soft,
  },
  desktopBookingCard: {
    width: 'calc(50% - 10px)',
    borderRadius: 16,
    padding: 20,
  },
  bookingCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  statusText: {
    fontWeight: '700',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  bookingCardBody: {
    gap: 14,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.light.primary + '10',
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    marginBottom: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontWeight: '600',
  },
  infoValue: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.light.text,
  },
  infoTime: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  notesContainer: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: '#F8F8F8',
    padding: 12,
    borderRadius: 8,
    marginTop: 4,
  },
  notesText: {
    flex: 1,
    fontSize: 13,
    color: Colors.light.textSecondary,
    lineHeight: 18,
  },
});
