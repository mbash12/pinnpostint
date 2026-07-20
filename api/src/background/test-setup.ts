// Simple test file to verify job queue setup
import { initializeJobQueue } from './utils/initialization';

async function testJobQueueSetup() {
  try {
    console.log('Testing job queue setup...');
    
    // Initialize the job queue
    const manager = await initializeJobQueue();
    console.log('✓ Job queue manager initialized successfully');
    
    // Test adding a simple job
    const job = await manager.addJob('test-job', { message: 'Hello World' });
    console.log('✓ Test job added successfully:', job.id);
    
    // Test getting job status
    const status = await manager.getJobStatus(job.id);
    console.log('✓ Job status retrieved:', status);
    
    // Get queue stats
    const stats = await manager.getQueueStats('test-job');
    console.log('✓ Queue stats:', stats);
    
    console.log('All tests passed! Job queue infrastructure is working.');
    
    // Cleanup
    await manager.closeAllQueues();
    
  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  }
}

// Only run if this file is executed directly
if (require.main === module) {
  testJobQueueSetup();
}

export { testJobQueueSetup };
