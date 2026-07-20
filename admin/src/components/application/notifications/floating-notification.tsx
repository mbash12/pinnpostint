'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Bell01, Check, RefreshCw05, X } from '@untitledui/icons';
import { useNotifications, useNotificationStats, type Notification } from '@/hooks/use-notifications';
import { apiClient } from '@/lib/api-client';
import { cx } from '@/utils/cx';
import { useAdminPushNotifications } from '@/hooks/use-admin-push-notifications';
import { useAuth } from '@/providers/auth-provider';
import { PollingNotificationToast } from '@/components/application/notifications/polling-notification-toast';

interface FloatingNotificationProps {
  refreshInterval?: number;
}

export function FloatingNotification({ refreshInterval = 10000 }: FloatingNotificationProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [activeNotifications, setActiveNotifications] = useState<Notification[]>([]);
  
  const { isAuthenticated } = useAuth();
  const { lastNotification } = useAdminPushNotifications(isAuthenticated);
  const previousUnreadCountRef = useRef(0);
  const processedNotificationIdsRef = useRef<Set<string>>(new Set());
  const activeNotificationsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Stable reference for filters to prevent infinite refetch loops
  const notificationFilters = useMemo(() => ({ isRead: false }), []);

  const {
    notifications,
    isLoading,
    refreshNotifications,
  } = useNotifications({
    page: 1,
    limit: 5,
    filters: notificationFilters,
    autoRefresh: false,
  });

  const { data: statsData, refetch: refetchStats } = useNotificationStats();
  const currentUnreadCount = statsData?.unread || 0;

  // Fetch unread count separately with interval
  const fetchUnreadCount = useCallback(async () => {
    try {
      const response = await apiClient.get<{ unread: number }>('/admin/notifications/stats', {}, { skipLoading: true });
      if (response.success) {
        const newUnreadCount = response.data?.unread || 0;
        setUnreadCount(newUnreadCount);
        
        // Check if there are new unread notifications
        if (newUnreadCount > previousUnreadCountRef.current && previousUnreadCountRef.current > 0) {
          // Refresh notifications to get actual content
          refreshNotifications(true);
          
          // The refreshNotifications will update the notifications list
          setTimeout(() => {
            if (notifications.length > 0) {
              const newNotificationsCount = newUnreadCount - previousUnreadCountRef.current;
              const newUnreadNotifications = notifications.slice(0, newNotificationsCount);
              
              // Add each new notification to active list
              newUnreadNotifications.forEach(notification => {
                if (!processedNotificationIdsRef.current.has(notification.id)) {
                  processedNotificationIdsRef.current.add(notification.id);
                  setActiveNotifications(prev => [...prev, notification]);
                  
                  // Auto-dismiss after 5 seconds
                  const timeoutId = setTimeout(() => {
                    setActiveNotifications(prev => prev.filter(n => n.id !== notification.id));
                    activeNotificationsRef.current.delete(notification.id);
                  }, 5000);
                  
                  activeNotificationsRef.current.set(notification.id, timeoutId);
                }
              });
            }
          }, 500);
        }
        
        previousUnreadCountRef.current = newUnreadCount;
      }
    } catch (error) {
      console.error('Error fetching notification stats:', error);
    }
  }, [refreshNotifications, notifications]);

  // Initial load and periodic refresh
  useEffect(() => {
    fetchUnreadCount();

    // Set up periodic refresh
    const interval = setInterval(fetchUnreadCount, refreshInterval);
    return () => clearInterval(interval);
  }, [fetchUnreadCount, refreshInterval]);

  // Update unread count when push notification arrives
  useEffect(() => {
    if (lastNotification) {
      refetchStats();
      refreshNotifications();
    }
  }, [lastNotification, refetchStats, refreshNotifications]);

  // Refresh notifications and count when dropdown opens
  useEffect(() => {
    if (isOpen) {
      refetchStats();
      refreshNotifications();
      fetchUnreadCount();
    }
  }, [isOpen, refetchStats, refreshNotifications, fetchUnreadCount]);

  // Custom refresh that doesn't show loading overlay
  const handleRefresh = async () => {
    refreshNotifications(true);
    fetchUnreadCount();
  };

  const handleMarkAsRead = async (notificationId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await apiClient.put(`/admin/notifications/${notificationId}/read`, {});
      refreshNotifications(true);
      fetchUnreadCount();
    } catch (error) {
    }
  };

  const handleToastDismiss = (id: string) => {
    setActiveNotifications(prev => prev.filter(n => n.id !== id));

    // Clear's auto-dismiss timeout if it exists
    const timeoutId = activeNotificationsRef.current.get(id);
    if (timeoutId) {
      clearTimeout(timeoutId);
      activeNotificationsRef.current.delete(id);
    }
  };

  const handleNotificationClick = async (notification: Notification) => {
    // Mark as read
    if (!notification.isRead) {
      try {
        await apiClient.put(`/admin/notifications/${notification.id}/read`, {});
      } catch (e) {}
    }

    setIsOpen(false);

    // Navigate based on notification type
    const action = notification.data?.action;

    switch (notification.type) {
      case 'ADMIN_ALERT':
        switch (action) {
          case 'review_ad':
          case 'review_flagged_ad':
            router.push(`/dashboard/ad-moderation/${notification.data?.adId}`);
            break;
          case 'view_booking':
            router.push(`/dashboard/booking-management/${notification.data?.bookingId}`);
            break;
          case 'view_payment':
            router.push('/dashboard/payments');
            break;
          case 'view_subscription':
            router.push(`/dashboard/ad-management/ads/${notification.data?.adId}`);
            break;
          default:
            router.push('/dashboard/admin-notifications');
        }
        break;
      case 'BOOKING':
      case 'BOOKING_UPDATE':
        router.push(`/dashboard/booking-management/${notification.data?.bookingId}`);
        break;
      case 'COMPLAINT':
        if (notification.data?.bookingId) {
          router.push(`/dashboard/booking-management/${notification.data.bookingId}`);
        } else {
          router.push('/dashboard/admin-notifications');
        }
        break;
      default:
        router.push('/dashboard/admin-notifications');
    }
  };

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      activeNotificationsRef.current.forEach(timeoutId => {
        clearTimeout(timeoutId);
      });
    };
  }, []);

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      BOOKING: 'bg-purple-100 text-purple-700',
      SYSTEM: 'bg-blue-100 text-blue-700',
      GENERAL: 'bg-gray-100 text-gray-700',
      PROMOTION: 'bg-green-100 text-green-700',
      AD_APPROVED: 'bg-emerald-100 text-emerald-700',
      AD_REJECTED: 'bg-red-100 text-red-700',
      BOOKING_UPDATE: 'bg-indigo-100 text-indigo-700',
      SUBSCRIPTION_EXPIRY: 'bg-orange-100 text-orange-700',
    };
    return colors[type] || colors.GENERAL;
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {/* In-App Notification Toasts - Supports Multiple */}
      <PollingNotificationToast
        notifications={activeNotifications}
        onDismiss={handleToastDismiss}
      />

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute bottom-16 right-0 w-80 sm:w-96 bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900">Notifications</h3>
            <div className="flex items-center gap-2">
              <button
                onClick={handleRefresh}
                className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                title="Refresh"
              >
                <RefreshCw05 className="w-4 h-4" />
              </button>
              <Link
                href="/dashboard/admin-notifications"
                onClick={() => setIsOpen(false)}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                View all
              </Link>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors ml-2"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Bell01 className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                <p>No new notifications</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    className="p-4 hover:bg-gray-50 transition-colors cursor-pointer"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={cx(
                            "px-2 py-0.5 text-xs font-medium rounded-full",
                            getTypeColor(notification.type)
                          )}>
                            {notification.type}
                          </span>
                          <span className="text-xs text-gray-400">
                            {formatTime(notification.sentAt)}
                          </span>
                          {!notification.isRead && (
                            <span className="w-2 h-2 bg-blue-600 rounded-full" />
                          )}
                        </div>
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {notification.title}
                        </p>
                        <p className="text-sm text-gray-600 line-clamp-2 mt-0.5">
                          {notification.message}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cx(
          "relative p-3 rounded-full transition-all duration-200",
          "bg-white shadow-lg border border-gray-200",
          "hover:shadow-xl hover:scale-105 active:scale-95",
          unreadCount > 0 ? "ring-2 ring-red-400 ring-offset-2" : ""
        )}
      >
        <Bell01 className="w-6 h-6 text-gray-700" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>
    </div>
  );
}
