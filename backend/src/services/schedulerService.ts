import * as cron from 'node-cron';
import { fetchAdvancedStationData } from './stationService';
import { advancedStationDataCache } from './cacheService';

class AdvancedDataScheduler {
  private cronJob: cron.ScheduledTask | null = null;
  private isRunning: boolean = false;

  /**
   * Start the cron job to fetch data every 10 minutes on the 9th minute
   * Cron pattern: '0 9,19,29,39,49,59 * * * *' (every 10 minutes on 9th minute)
   */
  public start(): void {
    if (this.cronJob) {
      console.log('[SCHEDULER] Cron job already running');
      return;
    }

    // Cron pattern: second minute hour day month dayOfWeek
    // '0 9,19,29,39,49,59 * * * *' runs at 9, 19, 29, 39, 49, 59 minutes of every hour
    this.cronJob = cron.schedule('0 9,19,29,39,49,59 * * * *', async () => {
      await this.fetchDataJob();
    }, {
      timezone: "UTC" // Use UTC to avoid timezone issues
    });

    this.isRunning = true;
    console.log('[SCHEDULER] Advanced station data cron job started - runs every 10 minutes on 9th minute');
    console.log('[SCHEDULER] Schedule: 9, 19, 29, 39, 49, 59 minutes of every hour');
    
    // Run initial fetch after a short delay
    setTimeout(() => {
      console.log('[SCHEDULER] Running initial data fetch...');
      this.fetchDataJob();
    }, 2000);
  }

  /**
   * Stop the cron job
   */
  public stop(): void {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
      this.isRunning = false;
      console.log('[SCHEDULER] Advanced station data cron job stopped');
    }
  }

  /**
   * Get scheduler status
   */
  public getStatus(): any {
    return {
      isRunning: this.isRunning,
      nextRun: this.cronJob ? this.getNextRunTime() : null,
      schedule: '0 9,19,29,39,49,59 * * * * (every 10 minutes on 9th minute)',
      timezone: 'UTC'
    };
  }

  /**
   * Manually trigger a data fetch (for testing)
   */
  public async triggerManualFetch(): Promise<any> {
    console.log('[SCHEDULER] Manual fetch triggered');
    return await this.fetchDataJob();
  }

  /**
   * The actual job that fetches and caches data
   */
  private async fetchDataJob(): Promise<any> {
    const startTime = advancedStationDataCache.recordFetchStart();
    
    try {
      console.log(`[SCHEDULER] Starting scheduled data fetch at ${new Date().toISOString()}`);
      
      // Fetch fresh data from database
      const data = await fetchAdvancedStationData();
      
      // Cache the data
      advancedStationDataCache.recordFetchSuccess(startTime, data);
      
      console.log(`[SCHEDULER] Scheduled fetch completed successfully`);
      return data;
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      advancedStationDataCache.recordFetchError(startTime, errorMessage);
      
      console.error('[SCHEDULER] Scheduled fetch failed:', error);
      throw error;
    }
  }

  /**
   * Calculate next run time based on cron schedule
   */
  private getNextRunTime(): Date {
    const now = new Date();
    const next = new Date(now);
    
    const currentMinutes = now.getMinutes();
    
    // Find next scheduled minute (9, 19, 29, 39, 49, 59)
    let nextMinute;
    if (currentMinutes < 9) nextMinute = 9;
    else if (currentMinutes < 19) nextMinute = 19;
    else if (currentMinutes < 29) nextMinute = 29;
    else if (currentMinutes < 39) nextMinute = 39;
    else if (currentMinutes < 49) nextMinute = 49;
    else if (currentMinutes < 59) nextMinute = 59;
    else {
      // Next hour
      next.setHours(next.getHours() + 1);
      nextMinute = 9;
    }
    
    next.setMinutes(nextMinute, 0, 0);
    return next;
  }
}

// Singleton instance
export const advancedDataScheduler = new AdvancedDataScheduler();