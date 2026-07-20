import { StyleSheet, FlatList, TouchableOpacity, Image, View, StatusBar, ActivityIndicator, RefreshControl, Linking } from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { Header } from '@/components/header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Footer } from '@/components/footer';
import { AuthProtection } from '@/components/auth-protection';
import { Colors, WebShadows } from '@/constants/theme';
import { HEADER_HEIGHT } from '@/constants/layout';
import { DesktopProfileLayout } from '@/components/desktop-profile-layout';
import { userService } from '@/services';
import { useResponsive } from '@/hooks/use-responsive';
import type { Notification, NotificationType } from '@/types/api.types';

const getNotificationIcon = (type: NotificationType): string => {
  switch (type) {
    case 'AD_APPROVED': return 'check-circle';
    case 'AD_REJECTED': return 'cancel';
    case 'BOOKING':
    case 'BOOKING_UPDATE':
    case 'COMPLAINT': return 'event';
    case 'SYSTEM': return 'settings';
    case 'PROMOTION': return 'local-offer';
    case 'SUBSCRIPTION_EXPIRY': return 'schedule';
    case 'PAYMENT': return 'payment';
    case 'GENERAL':
    default: return 'notifications';
  }
};

async function openAnnouncementTapTarget(
  data: Record<string, unknown> | null | undefined
): Promise<'url' | 'deep' | 'none'> {
  const url = typeof data?.url === 'string' ? data.url.trim() : '';
  const deepLink = typeof data?.deepLink === 'string' ? data.deepLink.trim() : '';
  if (url) {
    try {
      if (await Linking.canOpenURL(url)) {
        await Linking.openURL(url);
        return 'url';
      }
    } catch {
    }
  }
  return deepLink ? 'deep' : 'none';
}

const formatNotificationTime = (sentAt: string): string => {
  const now = new Date();
  const notificationDate = new Date(sentAt);
  const diffInMs = now.getTime() - notificationDate.getTime();
  const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
  const diffInHours = Math.floor(diffInMinutes / 60);
  const diffInDays = Math.floor(diffInHours / 24);

  if (diffInMinutes < 1) return 'Just now';
  if (diffInMinutes < 60) return `${diffInMinutes} minute${diffInMinutes > 1 ? 's' : ''} ago`;
  if (diffInHours < 24) return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;
  if (diffInDays < 7) return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`;
  return notificationDate.toLocaleDateString();
};

export default function NotificationsScreen() {
  const { isDesktop } = useResponsive();
  const router = useRouter();
  
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasInitialized, setHasInitialized] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  
  const fetchNotifications = useCallback(async (pageNum: number = 1, append: boolean = false, isRefresh: boolean = false) => {
    try {
      if (pageNum === 1) {
        setIsLoading(true);
        if (isRefresh) setIsRefreshing(true);
      } else {
        setLoadingMore(true);
      }
      const response = await userService.getNotifications({ page: pageNum, limit: 20 });
      if (response.success && response.data) {
        const newData = Array.isArray(response.data) ? response.data : response.data.data || [];
        if (append) {
          setNotifications(prev => [...prev, ...newData]);
        } else {
          setNotifications(newData);
        }
        setHasMore(newData.length === 20);
        setPage(pageNum);
      }
    } catch (error) {
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
      setLoadingMore(false);
      if (pageNum === 1) {
        setHasInitialized(true);
      }
    }
  }, []);

  useEffect(() => {
    fetchNotifications(1, false);
  }, []);

  const handleLoadMore = () => {
    if (!loadingMore && hasMore) {
      fetchNotifications(page + 1, true);
    }
  };
  
  const handleMarkAsRead = async (notificationId: string) => {
    try {
      await userService.markNotificationRead(notificationId);
      setNotifications(prev => prev.map(n => n.id === notificationId ? { ...n, isRead: true } : n));
    } catch (error) {
    }
  };

  const handleNotificationClick = async (notification: Notification) => {
    // Mark as read first
    if (!notification.isRead) {
      await handleMarkAsRead(notification.id);
    }

    // Navigate based on notification type and data
    switch (notification.type) {
      case 'AD_APPROVED':
      case 'AD_REJECTED':
      case 'AD_REVIEW':
      case 'AD_EXTENDED':
      case 'AD_EXPIRED':
        if (notification.data?.adId) {
          router.push(`/(pages)/ad-stats/${notification.data.adSlug || notification.data.adId}`);
        }
        break;

      case 'BOOKING':
      case 'BOOKING_UPDATE':
      case 'COMPLAINT':
        if (notification.data?.bookingId) {
          // Navigate to the appropriate booking detail page based on user role
          const isOwner = notification.data.isOwner === 'true' || notification.data.isOwner === true;
          const page = isOwner ? 'ad-booking-detail' : 'booking-detail';
          router.push(`/(pages)/${page}?id=${notification.data.bookingId}`);
        } else {
          // Navigate to my bookings page
          router.push(`/(pages)/my-bookings`);
        }
        break;

      case 'PAYMENT':
        // Handle payment notifications with deep linking
        if (notification.data?.type === 'subscription' && notification.data?.adSlug) {
          // Subscription renewal - navigate to ad detail
          router.push(`/(pages)/detail/${notification.data.adSlug}`);
        } else if (notification.data?.type === 'booking') {
          // Booking payment - navigate to booking detail or my-bookings
          if (notification.data?.bookingId) {
            router.push(`/(pages)/booking-detail?id=${notification.data.bookingId}`);
          } else {
            router.push(`/(pages)/my-bookings`);
          }
        } else if (notification.data?.deepLink) {
          // Use the deepLink if available
          router.push(notification.data.deepLink);
        }
        break;

      case 'PROMOTION':
      case 'SYSTEM':
      case 'GENERAL': {
        const opened = await openAnnouncementTapTarget(notification.data as Record<string, unknown> | undefined);
        if (opened === 'deep' && notification.data?.deepLink) {
          router.push(notification.data.deepLink);
        }
        break;
      }

      case 'SUBSCRIPTION_EXPIRY':
        // Navigate to settings or subscription page
        router.push(`/(pages)/settings`);
        break;

      default:
        // Default behavior - just mark as read
        break;
    }
  };

  const groupNotificationsByDate = (notifications: Notification[]) => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const groups: { [key: string]: Notification[] } = {
      today: [],
      yesterday: [],
      older: []
    };
    
    notifications.forEach(notification => {
      const notificationDate = notification.sentAt ? new Date(notification.sentAt) : new Date();
      
      if (notificationDate.toDateString() === today.toDateString()) {
        groups.today.push(notification);
      } else if (notificationDate.toDateString() === yesterday.toDateString()) {
        groups.yesterday.push(notification);
      } else {
        groups.older.push(notification);
      }
    });
    
    return groups;
  };

  const renderNotification = (notification: Notification) => (
    <TouchableOpacity 
      key={notification.id} 
      style={[styles.notificationCard, notification.isRead && styles.readCard]}
      activeOpacity={0.8}
      onPress={() => handleNotificationClick(notification)}
    >
      <View style={[styles.iconContainer, notification.isRead && styles.readIconContainer]}>
        <MaterialIcons 
          name={getNotificationIcon(notification.type) as any} 
          size={20} 
          color={notification.isRead ? Colors.light.textSecondary : "#FFFFFF"}
        />
      </View>
      <View style={styles.notificationContent}>
        <View style={styles.titleRow}>
          <ThemedText style={[styles.notificationTitle, notification.isRead && styles.readTitle]}>
            {notification.title}
          </ThemedText>
          {!notification.isRead && <View style={styles.unreadDot} />}
        </View>
        <ThemedText style={[styles.notificationDescription, notification.isRead && styles.readDescription]}>
          {notification.message}
        </ThemedText>
        <ThemedText style={styles.notificationTime}>
          {notification.sentAt ? formatNotificationTime(notification.sentAt) : ''}
        </ThemedText>
      </View>
    </TouchableOpacity>
  );

  const groups = groupNotificationsByDate(notifications);
  const sections = [
    { title: 'Today', data: groups.today },
    { title: 'Yesterday', data: groups.yesterday },
    { title: 'Earlier', data: groups.older }
  ].filter(section => section.data.length > 0);

  return (
    <AuthProtection>
      <DesktopProfileLayout>
        <ThemedView style={[styles.container, { paddingTop: isDesktop ? 0 : HEADER_HEIGHT }]}>
        <FlatList
          data={sections}
          keyExtractor={(item) => item.title}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => fetchNotifications(1, false, true)}
              colors={[Colors.light.primary]}
              tintColor={Colors.light.primary}
            />
          }
          ListHeaderComponent={
            <View style={[styles.header, isDesktop && { paddingHorizontal: 0 }]}>
              <ThemedText style={styles.title}>Notifications</ThemedText>
              <ThemedText style={styles.subtitle}>
                Stay updated with your latest activities
              </ThemedText>
            </View>
          }
          renderItem={({ item: section }) => (
            <View style={styles.section}>
              <ThemedText style={[styles.sectionTitle, isDesktop && { paddingHorizontal: 0 }]}>{section.title}</ThemedText>
              <View style={[styles.sectionContent, isDesktop && { marginHorizontal: 0 }]}>
                {section.data.map(renderNotification)}
              </View>
            </View>
          )}
          ListEmptyComponent={
            hasInitialized ? (
              <View style={styles.emptyState}>
                <View style={styles.emptyIconContainer}>
                  <MaterialIcons name="notifications-off" size={40} color={Colors.light.textSecondary} />
                </View>
                <ThemedText style={styles.emptyStateTitle}>No notifications</ThemedText>
                <ThemedText style={styles.emptyStateSubtitle}>
                  You&apos;re all caught up!
                </ThemedText>
              </View>
            ) : null
          }
          ListFooterComponent={
            <>
              {loadingMore ? (
                <ActivityIndicator size="large" color={Colors.light.primary} style={{ marginVertical: 20 }} />
              ) : null}
              {!isDesktop && <Footer />}
            </>
          }
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          showsVerticalScrollIndicator={false}
        />
        </ThemedView>
      </DesktopProfileLayout>
    </AuthProtection>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  listContent: {
    paddingBottom: 20,
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.light.textSecondary,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    marginTop: 12,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  sectionContent: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    borderRadius: 12,
    boxShadow: WebShadows.soft,
    elevation: 1,
  },
  // Empty State
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.light.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 8,
  },
  emptyStateSubtitle: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  // Notification Cards
  notificationCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'flex-start',
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  readCard: {
    opacity: 0.6,
    backgroundColor: '#FFFFFF',
  },
  iconContainer: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FF3B30',
    borderRadius: 8,
    marginRight: 12,
  },
  readIconContainer: {
    backgroundColor: Colors.light.backgroundSecondary,
  },
  notificationContent: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF3B30',
    marginTop: 6,
  },
  notificationTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.light.text,
    lineHeight: 20,
    flex: 1,
    marginRight: 8,
  },
  readTitle: {
    fontWeight: '500',
    color: Colors.light.textSecondary,
  },
  notificationDescription: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    lineHeight: 18,
    marginBottom: 6,
  },
  readDescription: {
    color: '#9CA3AF',
  },
  notificationTime: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    fontWeight: '500',
  },
});
