'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import { Bell01, X, CheckCircle, AlertCircle, InfoSquare, AlertTriangle } from '@untitledui/icons';
import { cx } from '@/utils/cx';
import { apiClient } from '@/lib/api-client';
import type { Notification } from '@/hooks/use-notifications';

interface PollingNotificationToastProps {
  notifications: Notification[];
  onDismiss: (id: string) => void;
}

const typeConfig: Record<string, { icon: React.ElementType; color: string; bgColor: string }> = {
  AD_APPROVED: { icon: CheckCircle, color: 'text-emerald-600', bgColor: 'bg-emerald-50' },
  AD_REJECTED: { icon: AlertCircle, color: 'text-red-600', bgColor: 'bg-red-50' },
  BOOKING: { icon: Bell01, color: 'text-purple-600', bgColor: 'bg-purple-50' },
  BOOKING_UPDATE: { icon: Bell01, color: 'text-indigo-600', bgColor: 'bg-indigo-50' },
  ADMIN_ALERT: { icon: AlertTriangle, color: 'text-orange-600', bgColor: 'bg-orange-50' },
  SYSTEM: { icon: InfoSquare, color: 'text-blue-600', bgColor: 'bg-blue-50' },
  GENERAL: { icon: InfoSquare, color: 'text-gray-600', bgColor: 'bg-gray-50' },
  PROMOTION: { icon: InfoSquare, color: 'text-green-600', bgColor: 'bg-green-50' },
  SUBSCRIPTION_EXPIRY: { icon: AlertCircle, color: 'text-orange-600', bgColor: 'bg-orange-50' },
};

export function PollingNotificationToast({ notifications, onDismiss }: PollingNotificationToastProps) {
  const router = useRouter();

  const handleDismiss = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    onDismiss(id);
  };

  const handleClick = async (notification: Notification) => {
    // Mark as read
    if (!notification.isRead) {
      try {
        await apiClient.put(`/admin/notifications/${notification.id}/read`, {});
      } catch (e) {}
    }

    onDismiss(notification.id);
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
        break;
    }
  };

  return (
    <div className="fixed top-6 right-6 z-[100] w-80">
      <AnimatePresence mode="popLayout">
        {notifications.map((notification, index) => {
          const type = notification.type || 'GENERAL';
          const config = typeConfig[type] || typeConfig.GENERAL;
          const Icon = config.icon;

          return (
            <motion.div
              key={notification.id}
              initial={{ opacity: 0, x: 100, scale: 0.95 }}
              animate={{ 
                opacity: 1, 
                x: 0,
                y: index * 4,
                scale: 1 
              }}
              exit={{ opacity: 0, x: 100, scale: 0.95 }}
              transition={{ 
                duration: 0.3, 
                ease: 'easeOut',
                layout: { duration: 0.2 }
              }}
              className="mb-1"
            >
              <div
                onClick={() => handleClick(notification)}
                className={cx(
                  'cursor-pointer overflow-hidden rounded-lg border shadow-md transition-all duration-200',
                  'bg-white border-gray-200 hover:shadow-lg hover:border-gray-300',
                  'flex items-center gap-2 p-3'
                )}
              >
                <div className={cx('flex-shrink-0 rounded-md p-1.5', config.bgColor)}>
                  <Icon className={cx('h-4 w-4', config.color)} />
                </div>

                <div className="flex-1 min-w-0">
                  <h4 className="text-xs font-semibold text-gray-900 line-clamp-1">
                    {notification.title}
                  </h4>
                  <p className="text-xs text-gray-600 line-clamp-1 mt-0.5">
                    {notification.message}
                  </p>
                </div>

                <button
                  onClick={(e) => handleDismiss(e, notification.id)}
                  className="flex-shrink-0 p-0.5 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

export default PollingNotificationToast;
