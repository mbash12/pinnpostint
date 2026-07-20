/**
 * Simple test script to verify scheduler and cleanup functionality
 * This is a standalone script for testing the background system
 */

import { initializeJobQueue, initializeScheduler, shutdownJobQueue } from './utils/initialization';
import { getCleanupStats } from './handlers/data-cleanup.handler';

async function testSchedulerSystem() {
  console.log('🚀 Testing Background Scheduler System...\n');

  try {
    // Initialize the job queue and scheduler
    console.log('1. Initializing job queue...');
    const jobQueueManager = await initializeJobQueue();
    console.log('✅ Job queue initialized\n');

    console.log('2. Initializing scheduler...');
    const scheduler = await initializeScheduler();
    console.log('✅ Scheduler initialized\n');

    // Test scheduler status
    console.log('3. Getting schedule status...');
    const scheduleStatus = await scheduler.getScheduleStatus();
    console.log('📋 Schedule Status:');
    scheduleStatus.forEach(schedule => {
      console.log(`  - ${schedule.name}: ${schedule.jobType} (${schedule.cron}) - Active: ${schedule.isActive}`);
      if (schedule.nextRun) {
        console.log(`    Next run: ${schedule.nextRun.toISOString()}`);
      }
    });
    console.log('');

    // Test manual job trigger
    console.log('4. Testing manual job trigger...');
    await scheduler.triggerScheduledJob('daily-cleanup');
    console.log('✅ Manual cleanup job triggered\n');

    // Wait a moment for job to process
    console.log('5. Waiting for job to process...');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Get cleanup statistics
    console.log('6. Getting cleanup statistics...');
    const cleanupStats = await getCleanupStats();
    console.log('📊 Cleanup Statistics:');
    console.log(`  - Pending OTPs: ${cleanupStats.pendingOtps}`);
    console.log(`  - Unread Notifications: ${cleanupStats.unreadNotifications}`);
    console.log(`  - Pending Transactions: ${cleanupStats.pendingTransactions}`);
    console.log(`  - Review Ads: ${cleanupStats.reviewAds}`);
    console.log('');

    // Test job queue statistics
    console.log('7. Getting job queue statistics...');
    const jobCounts = await jobQueueManager.getJobCounts();
    console.log('📈 Job Queue Statistics:');
    console.log(`  - Pending: ${jobCounts.pending}`);
    console.log(`  - Processing: ${jobCounts.processing}`);
    console.log(`  - Completed: ${jobCounts.completed}`);
    console.log(`  - Failed: ${jobCounts.failed}`);
    console.log('');

    console.log('✅ All tests completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  } finally {
    // Clean shutdown
    console.log('\n8. Shutting down...');
    await shutdownJobQueue();
    console.log('✅ Shutdown complete');
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  testSchedulerSystem()
    .then(() => {
      console.log('\n🎉 Scheduler system test completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Scheduler system test failed:', error);
      process.exit(1);
    });
}

export { testSchedulerSystem };