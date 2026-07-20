/**
 * Notifications Components
 * Export all notification-related components
 */

export { NotificationManagement } from './notification-management';
export { NotificationPreferencesComponent } from './notification-preferences';
export { FloatingNotification } from './floating-notification';
export { PushNotificationToast } from './push-notification-toast';
export { PollingNotificationToast } from './polling-notification-toast';

export type {
  NotificationType,
  Notification,
  NotificationPreferences,
  SendNotificationRequest,
  NotificationFilters,
} from '@/hooks/use-notifications';

export type { PushNotificationPayload } from '@/hooks/use-admin-push-notifications';
