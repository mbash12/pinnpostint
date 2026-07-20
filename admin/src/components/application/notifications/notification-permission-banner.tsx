'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bell01, X, ChevronRight } from '@untitledui/icons';
import { cx } from '@/utils/cx';

interface NotificationPermissionBannerProps {
  isVisible: boolean;
  onRequestPermission: () => Promise<boolean>;
  onDismiss: () => void;
  isLoading?: boolean;
}

export function NotificationPermissionBanner({
  isVisible,
  onRequestPermission,
  onDismiss,
  isLoading = false
}: NotificationPermissionBannerProps) {
  const [error, setError] = useState<string | null>(null);

  const handleEnable = async () => {
    setError(null);
    const success = await onRequestPermission();
    if (!success) {
      setError('Permission was denied. Please enable notifications in your browser settings.');
    }
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.2 }}
          className="fixed top-0 left-0 right-0 z-[100] bg-gradient-to-r from-blue-600 to-indigo-600 text-white"
        >
          <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0 rounded-lg bg-white/20 p-2">
                  <Bell01 className="h-5 w-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white">
                    Enable push notifications
                  </p>
                  <p className="text-xs text-blue-100 mt-0.5">
                    Stay updated with ad approvals, bookings, and system alerts in real-time
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={handleEnable}
                  disabled={isLoading}
                  className={cx(
                    'inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium',
                    'bg-white text-blue-600 hover:bg-blue-50 transition-colors',
                    'disabled:opacity-50 disabled:cursor-not-allowed'
                  )}
                >
                  {isLoading ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
                      Enabling...
                    </>
                  ) : (
                    <>
                      Enable
                      <ChevronRight className="h-4 w-4" />
                    </>
                  )}
                </button>

                <button
                  onClick={onDismiss}
                  className="p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
                  title="Dismiss"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {error && (
              <motion.p
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="mt-2 text-xs text-red-200 bg-red-900/30 rounded px-3 py-2"
              >
                {error}
              </motion.p>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default NotificationPermissionBanner;
