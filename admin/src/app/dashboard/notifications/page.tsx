/**
 * Notifications Management Page
 * Admin dashboard page for managing notifications
 */

'use client';

import React from 'react';
import { NotificationManagement } from '@/components/application/notifications';

export default function NotificationsPage() {
  return (
    <div className="p-6">
      <NotificationManagement />
    </div>
  );
}
