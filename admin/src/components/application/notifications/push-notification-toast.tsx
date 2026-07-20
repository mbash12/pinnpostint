'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import { Bell01, X, CheckCircle, AlertCircle, InfoSquare, AlertTriangle } from '@untitledui/icons';
import { cx } from '@/utils/cx';
import { apiClient } from '@/lib/api-client';
import type { PushNotificationPayload } from '@/hooks/use-admin-push-notifications';

interface PushNotificationToastProps {
  notification: PushNotificationPayload | null;
  onDismiss: () => void;
}

const typeConfig: Record<string, { icon: React.ElementType; color: string; bgColor: string }> = {
  AD_APPROVED: { icon: CheckCircle, color: 'text-emerald-600', bgColor: 'bg-emerald-50' },
  AD_REJECTED: { icon: AlertCircle, color: 'text-red-600', bgColor: 'bg-red-50' },
  BOOKING: { icon: Bell01, color: 'text-purple-600', bgColor: 'bg-purple-50' },
  BOOKING_UPDATE: { icon: Bell01, color: 'text-indigo-600', bgColor: 'bg-indigo-50' },
  ADMIN_ALERT: { icon: AlertTriangle, color: 'text-orange-600', bgColor: 'bg-orange-50' },
  SYSTEM: { icon: InfoSquare, color: 'text-blue-600', bgColor: 'bg-blue-50' },
  GENERAL: { icon: InfoSquare, color: 'text-gray-600', bgColor: 'bg-gray-50' },
};

export function PushNotificationToast({ notification, onDismiss }: PushNotificationToastProps) {
  const router = useRouter();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (notification) {
      setIsVisible(true);
      // Auto-dismiss after 8 seconds
      const timer = setTimeout(() => {
        setIsVisible(false);
        setTimeout(onDismiss, 300);
      }, 8000);
      return () => clearTimeout(timer);
    }
  }, [notification, onDismiss]);

  if (!notification) return null;

  const type = notification.data?.type || 'GENERAL';
  const config = typeConfig[type] || typeConfig.GENERAL;
  const Icon = config.icon;

  const handleClick = () => {
    setIsVisible(false);
    onDismiss();

    // Navigate based on notification type
    const action = notification.data?.action;

    switch (type) {
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

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsVisible(false);
    setTimeout(onDismiss, 300);
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: -50, x: '-50%' }}
          animate={{ opacity: 1, y: 0, x: '-50%' }}
          exit={{ opacity: 0, y: -50, x: '-50%' }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="fixed top-6 left-1/2 z-[100] w-full max-w-md px-4"
        >
          <div
            onClick={handleClick}
            className={cx(
              'cursor-pointer overflow-hidden rounded-xl border shadow-lg transition-all duration-200',
              'bg-white border-gray-200 hover:shadow-xl hover:border-gray-300',
              'flex items-start gap-3 p-4'
            )}
          >
            <div className={cx('flex-shrink-0 rounded-lg p-2', config.bgColor)}>
              <Icon className={cx('h-5 w-5', config.color)} />
            </div>

            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-semibold text-gray-900">
                {notification.notification?.title || 'New Notification'}
              </h4>
              <p className="mt-1 text-sm text-gray-600 line-clamp-2">
                {notification.notification?.body || ''}
              </p>
              <p className="mt-2 text-xs text-gray-400">Click to view</p>
            </div>

            <button
              onClick={handleDismiss}
              className="flex-shrink-0 p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default PushNotificationToast;
