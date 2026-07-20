/**
 * Simple test file to verify job handlers are working correctly
 * This file can be used for manual testing of the job handlers
 */

import { Job, JobStatus, JobPriority } from '../interfaces/job.interface';
import { 
  adExpirationReminderHandler,
  adExpirationCleanupHandler,
  notificationDeliveryHandler
} from './index';
import { NotificationType } from '@prisma/client';

// Mock job data for testing
const createMockJob = <T = unknown>(type: string, data: T): Job<T> => ({
  id: `test-job-${Date.now()}`,
  type,
  data,
  status: JobStatus.PROCESSING,
  attempts: 0,
  maxAttempts: 3,
  priority: JobPriority.NORMAL,
  createdAt: new Date()
});

/**
 * Test ad expiration reminder handler
 */
export async function testAdExpirationReminder() {
  console.log('Testing ad expiration reminder handler...');

  const job = createMockJob('ad-expiration-reminder', {
    daysBeforeExpiry: [3]
  });
  
  try {
    await adExpirationReminderHandler(job);
    console.log('✅ Ad expiration reminder handler test passed');
  } catch (error) {
    console.error('❌ Ad expiration reminder handler test failed:', error);
  }
}

/**
 * Test ad expiration cleanup handler
 */
export async function testAdExpirationCleanup() {
  console.log('Testing ad expiration cleanup handler...');
  
  const job = createMockJob('ad-expiration-cleanup', {});
  
  try {
    await adExpirationCleanupHandler(job);
    console.log('✅ Ad expiration cleanup handler test passed');
  } catch (error) {
    console.error('❌ Ad expiration cleanup handler test failed:', error);
  }
}

/**
 * Test payment webhook handler
 */

/**
 * Test notification delivery handler
 */
export async function testNotificationDeliveryHandler() {
  console.log('Testing notification delivery handler...');
  
  const job = createMockJob('notification-delivery', {
    userId: 'test-user-id',
    title: 'Test Notification',
    message: 'This is a test notification',
    type: NotificationType.SYSTEM,
    channels: ['push', 'email'] as ('push' | 'email' | 'sms')[]
  });
  
  try {
    await notificationDeliveryHandler(job);
    console.log('✅ Notification delivery handler test passed');
  } catch (error) {
    console.error('❌ Notification delivery handler test failed:', error);
  }
}

/**
 * Run all handler tests
 */
export async function runAllHandlerTests() {
  console.log('🧪 Running job handler tests...\n');
  
  await testAdExpirationReminder();
  await testAdExpirationCleanup();
  await testNotificationDeliveryHandler();
  
  console.log('\n✨ All handler tests completed');
}

// Export for potential use in other test files
export {
  createMockJob
};
