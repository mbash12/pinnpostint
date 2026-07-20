/**
 * Notification Management Component
 * Handles sending and managing notifications in the admin panel
 */

import React, { useState } from 'react';
import { 
  useNotifications, 
  type NotificationType, 
  type SendNotificationRequest,
  type NotificationFilters 
} from '@/hooks/use-notifications';

interface NotificationManagementProps {
  className?: string;
}

export const NotificationManagement: React.FC<NotificationManagementProps> = ({ 
  className = '' 
}) => {
  const {
    notifications,
    isLoading,
    error,
    pagination,
    sendNotification,
    refreshNotifications,
    setPage,
    setFilters,
  } = useNotifications({
    page: 1,
    limit: 20,
    autoRefresh: true,
  });

  const [showSendForm, setShowSendForm] = useState(false);
  const [sendingNotification, setSendingNotification] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendSuccess, setSendSuccess] = useState<string | null>(null);

  // Form state for sending notifications
  const [formData, setFormData] = useState<SendNotificationRequest>({
    title: '',
    message: '',
    type: 'GENERAL',
    sendToAll: true,
  });

  const [filters, setLocalFilters] = useState<NotificationFilters>({});

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

  const handleSendNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title.trim() || !formData.message.trim()) {
      setSendError('Title and message are required');
      return;
    }

    try {
      setSendingNotification(true);
      setSendError(null);
      setSendSuccess(null);

      const result = await sendNotification(formData);

      if (result.success) {
        setSendSuccess('Notification sent successfully!');
        setFormData({
          title: '',
          message: '',
          type: 'GENERAL',
          sendToAll: true,
        });
        setShowSendForm(false);
      } else {
        setSendError(result.error || 'Failed to send notification');
      }
    } catch (err) {
      setSendError('Failed to send notification');
    } finally {
      setSendingNotification(false);
    }
  };

  const handleFilterChange = (newFilters: Partial<NotificationFilters>) => {
    const updatedFilters = { ...filters, ...newFilters };
    setLocalFilters(updatedFilters);
    setFilters(updatedFilters);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getTypeColor = (type: NotificationType) => {
    const colors = {
      GENERAL: 'bg-gray-100 text-gray-800',
      SYSTEM: 'bg-blue-100 text-blue-800',
      PROMOTION: 'bg-green-100 text-green-800',
      AD_APPROVED: 'bg-emerald-100 text-emerald-800',
      AD_REJECTED: 'bg-red-100 text-red-800',
      BOOKING: 'bg-purple-100 text-purple-800',
      BOOKING_UPDATE: 'bg-indigo-100 text-indigo-800',
      SUBSCRIPTION_EXPIRY: 'bg-orange-100 text-orange-800',
      ADMIN_ALERT: 'bg-yellow-100 text-yellow-800',
      COMPLAINT: 'bg-red-100 text-red-800',
    };
    return colors[type] || colors.GENERAL;
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Notification Management</h1>
          <p className="text-sm text-gray-600 mt-1">
            Send and manage notifications to users
          </p>
        </div>
        <button
          onClick={() => setShowSendForm(!showSendForm)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
        >
          {showSendForm ? 'Cancel' : 'Send Notification'}
        </button>
      </div>

      {/* Success/Error Messages */}
      {sendSuccess && (
        <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg">
          {sendSuccess}
        </div>
      )}

      {sendError && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
          {sendError}
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Send Notification Form */}
      {showSendForm && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Send New Notification</h2>
          
          <form onSubmit={handleSendNotification} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Title *
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter notification title"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Type
                </label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as NotificationType })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {notificationTypes.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Message *
              </label>
              <textarea
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter notification message"
                required
              />
            </div>

            <div className="flex items-center space-x-4">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.sendToAll}
                  onChange={(e) => setFormData({ ...formData, sendToAll: e.target.checked })}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-700">Send to all users</span>
              </label>
            </div>

            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setShowSendForm(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={sendingNotification}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {sendingNotification ? 'Sending...' : 'Send Notification'}
              </button>
            </div>
          </form>
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
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium text-gray-900">Recent Notifications</h3>
            <button
              onClick={() => refreshNotifications()}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              Refresh
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-gray-600 mt-2">Loading notifications...</p>
          </div>
        ) : notifications.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No notifications found
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {notifications.map((notification) => (
              <div key={notification.id} className="p-6 hover:bg-gray-50">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <h4 className="text-sm font-medium text-gray-900">
                        {notification.title}
                      </h4>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getTypeColor(notification.type)}`}>
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
                      Sent: {formatDate(notification.sentAt)}
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
    </div>
  );
};

export default NotificationManagement;