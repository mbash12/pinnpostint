'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell01, RefreshCw05 } from '@untitledui/icons';
import { useNotifications, type NotificationType, type NotificationFilters, type Notification } from '@/hooks/use-notifications';
import { apiClient } from '@/lib/api-client';
import { cx } from '@/utils/cx';
import { AlertDialog } from '@/components/application/modals/alert-dialog';

export default function AdminNotificationsPage() {
  const router = useRouter();
  const [filters, setLocalFilters] = useState<NotificationFilters>({});
  const [alertDialog, setAlertDialog] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    type: "success" | "error" | "warning" | "info";
  }>({ isOpen: false, title: "", description: "", type: "info" });
  
  const {
    notifications,
    isLoading,
    error,
    pagination,
    refreshNotifications,
    setPage,
    setFilters,
  } = useNotifications({
    page: 1,
    limit: 20,
    filters,
    autoRefresh: false,
  });

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      await apiClient.put(`/admin/notifications/${notificationId}/read`, {});
      refreshNotifications();
    } catch (error: any) {
      setAlertDialog({
        isOpen: true,
        title: "Error",
        description: error?.message || "Failed to mark notification as read",
        type: "error",
      });
    }
  };

  const handleNotificationClick = async (notification: Notification) => {
    // Mark as read
    if (!notification.isRead) {
      try {
        await apiClient.put(`/admin/notifications/${notification.id}/read`, {});
        refreshNotifications();
      } catch (e) {}
    }

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

  const handleFilterChange = (newFilters: Partial<NotificationFilters>) => {
    const updated = { ...filters, ...newFilters };
    setLocalFilters(updated);
    setFilters(updated);
  };

  const getTypeColor = (type: NotificationType) => {
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const notificationTypes: { value: NotificationType; label: string }[] = [
    { value: 'GENERAL', label: 'General' },
    { value: 'SYSTEM', label: 'System' },
    { value: 'PROMOTION', label: 'Promotion' },
    { value: 'AD_APPROVED', label: 'Ad Approved' },
    { value: 'AD_REJECTED', label: 'Ad Rejected' },
    { value: 'BOOKING', label: 'Booking' },
    { value: 'BOOKING_UPDATE', label: 'Booking Update' },
    { value: 'SUBSCRIPTION_EXPIRY', label: 'Subscription Expiry' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">My Notifications</h1>
          <p className="text-sm text-gray-600 mt-1">
            Notifications you receive as an admin
          </p>
        </div>
        <button
          onClick={() => refreshNotifications()}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <RefreshCw05 className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h3 className="text-sm font-medium text-gray-900 mb-3">Filters</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Type
            </label>
            <select
              value={filters.type || ''}
              onChange={(e) => handleFilterChange({ type: e.target.value as NotificationType || undefined })}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All Types</option>
              {notificationTypes.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Status
            </label>
            <select
              value={filters.isRead?.toString() || ''}
              onChange={(e) => handleFilterChange({ 
                isRead: e.target.value === '' ? undefined : e.target.value === 'true' 
              })}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All</option>
              <option value="false">Unread</option>
              <option value="true">Read</option>
            </select>
          </div>

          <div className="flex items-end">
            <button
              onClick={() => {
                setLocalFilters({});
                setFilters({});
              }}
              className="px-3 py-2 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {/* Notifications List */}
      <div className="bg-white border border-gray-200 rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Notifications</h3>
        </div>

        {isLoading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-gray-600 mt-2">Loading notifications...</p>
          </div>
        ) : notifications.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <Bell01 className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>No notifications found</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {notifications.map((notification) => (
              <div
                key={notification.id}
                onClick={() => handleNotificationClick(notification)}
                className={cx(
                  "p-6 hover:bg-gray-50 transition-colors cursor-pointer",
                  !notification.isRead && "bg-blue-50/50"
                )}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <h4 className={cx(
                        "text-sm",
                        notification.isRead ? "font-medium text-gray-900" : "font-semibold text-gray-900"
                      )}>
                        {notification.title}
                      </h4>
                      <span className={cx(
                        "px-2 py-1 text-xs font-medium rounded-full",
                        getTypeColor(notification.type)
                      )}>
                        {notification.type}
                      </span>
                      {!notification.isRead && (
                        <span className="w-2 h-2 bg-blue-600 rounded-full"></span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mb-2">
                      {notification.message}
                    </p>
                    <p className="text-xs text-gray-500">
                      Received: {formatDate(notification.sentAt)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-200">
            <div className="flex justify-between items-center">
              <p className="text-sm text-gray-700">
                Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
                {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
                {pagination.total} notifications
              </p>
              <div className="flex space-x-2">
                <button
                  onClick={() => setPage(pagination.page - 1)}
                  disabled={!pagination.hasPreviousPage}
                  className="px-3 py-1 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage(pagination.page + 1)}
                  disabled={!pagination.hasNextPage}
                  className="px-3 py-1 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <AlertDialog
        isOpen={alertDialog.isOpen}
        onClose={() => setAlertDialog({ ...alertDialog, isOpen: false })}
        title={alertDialog.title}
        description={alertDialog.description}
        type={alertDialog.type}
      />
    </div>
  );
}
