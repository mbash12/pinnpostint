# Background Scheduler System

This module implements a cron-based job scheduler for Pin N Post API background processing system.

## Features

- **Cron Scheduling**: Schedule recurring jobs using cron expressions
- **Job Management**: Add, remove, and monitor scheduled jobs
- **Manual Triggers**: Manually trigger scheduled jobs for testing
- **Status Monitoring**: Get real-time status of all scheduled jobs
- **Data Cleanup**: Automated cleanup of expired data and orphaned records

## Components

### CronScheduler

The main scheduler class that manages recurring jobs.

```typescript
import { CronScheduler } from './scheduler/cron-scheduler';
import { initializeScheduler } from './utils/initialization';

// Initialize scheduler
const scheduler = await initializeScheduler();

// Get schedule status
const status = await scheduler.getScheduleStatus();

// Manually trigger a job
await scheduler.triggerScheduledJob('daily-cleanup');
```

### Data Cleanup Jobs

Automated cleanup jobs that maintain database hygiene:

#### Daily Cleanup
- Removes expired OTPs (older than 24 hours)
- Removes old read notifications (older than 30 days)
- Runs daily at 2 AM

#### Weekly Cleanup
- Includes all daily cleanup tasks
- Removes old completed/failed transactions (older than 90 days)
- Removes orphaned records (safety cleanup)
- Runs weekly on Sunday at 3 AM

## Configuration

Scheduled jobs are configured in `config/job.config.ts`:

```typescript
schedules: {
  'daily-cleanup': {
    cron: '0 2 * * *', // Daily at 2 AM
    jobType: 'data-cleanup',
    data: { type: 'daily' },
  },
  'weekly-cleanup': {
    cron: '0 3 * * 0', // Weekly on Sunday at 3 AM
    jobType: 'data-cleanup',
    data: { type: 'weekly' },
  },
  'ad-expiration-check': {
    cron: '*/10 2-4 * * *', // Every 10 min 8-10 AM IST
    jobType: 'ad-expiration-reminder',
  },
}
```

## Usage

### Initialize the Scheduler

```typescript
import { initializeScheduler } from '../utils/initialization';

const scheduler = await initializeScheduler();
```

### Monitor Scheduled Jobs

```typescript
// Get status of all scheduled jobs
const schedules = await scheduler.getScheduleStatus();

schedules.forEach(schedule => {
  console.log(`${schedule.name}: ${schedule.isActive ? 'Active' : 'Inactive'}`);
  console.log(`Next run: ${schedule.nextRun}`);
});
```

### Manual Job Execution

```typescript
// Trigger a cleanup job manually
await scheduler.triggerScheduledJob('daily-cleanup');

// Get cleanup statistics
import { getCleanupStats } from '../handlers/data-cleanup.handler';
const stats = await getCleanupStats();
```

### Update Schedules

```typescript
// Update schedule configuration
await scheduler.updateSchedules({
  'custom-cleanup': {
    cron: '0 4 * * *',
    jobType: 'data-cleanup',
    data: { type: 'daily' }
  }
});
```

## Testing

Run the scheduler test to verify functionality:

```bash
cd api
npx ts-node src/background/test-scheduler.ts
```

## Monitoring

The scheduler provides comprehensive logging and statistics:

- Job execution logs with timing information
- Cleanup statistics (items cleaned, duration)
- Queue status and job counts
- Error handling and retry information

## Error Handling

- Failed jobs are automatically retried according to job configuration
- Comprehensive error logging for debugging
- Graceful shutdown handling
- Redis connection error recovery

## Requirements Satisfied

This implementation satisfies the following requirements:

- **3.1**: Daily cleanup of expired sessions and data
- **3.2**: Weekly cleanup of old files and transactions  
- **3.3**: Cleanup statistics logging for monitoring
- **1.1**: Automated job scheduling and execution
- **1.2**: Job retry and error handling