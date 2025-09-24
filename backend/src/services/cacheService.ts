// Cache service for storing advanced station data
interface CachedData {
  data: any;
  lastUpdated: Date;
  nextUpdate: Date;
  isStale: boolean;
}

interface CacheMetadata {
  totalFetches: number;
  lastFetchDuration: number;
  lastError: string | null;
  cacheHits: number;
  averageFetchTime: number;
}

class AdvancedStationDataCache {
  private cache: CachedData | null = null;
  private readonly metadata: CacheMetadata = {
    totalFetches: 0,
    lastFetchDuration: 0,
    lastError: null,
    cacheHits: 0,
    averageFetchTime: 0
  };
  private readonly fetchTimes: number[] = [];

  /**
   * Store data in cache with metadata
   */
  public setData(data: any): void {
    const now = new Date();
    const nextUpdate = this.calculateNextUpdateTime(now);
    
    this.cache = {
      data,
      lastUpdated: now,
      nextUpdate,
      isStale: false
    };
    
    console.log(`[CACHE] Data cached at ${now.toISOString()}, next update at ${nextUpdate.toISOString()}`);
  }

  /**
   * Get cached data if available
   */
  public getData(): any {
    if (!this.cache) {
      console.log('[CACHE] No data in cache');
      return null;
    }

    const now = new Date();
    
    // Mark as stale if past next update time
    if (now > this.cache.nextUpdate) {
      this.cache.isStale = true;
      console.log('[CACHE] Data is stale but will be served');
    }

    this.metadata.cacheHits++;
    console.log(`[CACHE] Serving cached data (${this.cache.isStale ? 'stale' : 'fresh'}), cache hits: ${this.metadata.cacheHits}`);
    
    return this.cache.data;
  }

  /**
   * Check if cache has data (fresh or stale)
   */
  public hasData(): boolean {
    return this.cache !== null;
  }

  /**
   * Check if cached data is fresh (not stale)
   */
  public isFresh(): boolean {
    if (!this.cache) return false;
    return !this.cache.isStale && new Date() <= this.cache.nextUpdate;
  }

  /**
   * Record fetch attempt metrics
   */
  public recordFetchStart(): Date {
    return new Date();
  }

  /**
   * Record successful fetch completion
   */
  public recordFetchSuccess(startTime: Date, data: any): void {
    const duration = Date.now() - startTime.getTime();
    
    this.metadata.totalFetches++;
    this.metadata.lastFetchDuration = duration;
    this.metadata.lastError = null;
    
    // Keep rolling average of last 10 fetch times
    this.fetchTimes.push(duration);
    if (this.fetchTimes.length > 10) {
      this.fetchTimes.shift();
    }
    this.metadata.averageFetchTime = this.fetchTimes.reduce((a, b) => a + b, 0) / this.fetchTimes.length;
    
    this.setData(data);
    
    console.log(`[CACHE] Fetch completed in ${duration}ms (avg: ${Math.round(this.metadata.averageFetchTime)}ms)`);
  }

  /**
   * Record fetch failure
   */
  public recordFetchError(startTime: Date, error: string): void {
    const duration = Date.now() - startTime.getTime();
    
    this.metadata.totalFetches++;
    this.metadata.lastFetchDuration = duration;
    this.metadata.lastError = error;
    
    console.error(`[CACHE] Fetch failed after ${duration}ms: ${error}`);
  }

  /**
   * Get cache status and metadata
   */
  public getStatus(): any {
    return {
      hasData: this.hasData(),
      isFresh: this.isFresh(),
      cacheInfo: this.cache ? {
        lastUpdated: this.cache.lastUpdated,
        nextUpdate: this.cache.nextUpdate,
        isStale: this.cache.isStale,
        dataSize: JSON.stringify(this.cache.data).length
      } : null,
      metadata: this.metadata,
      uptime: process.uptime()
    };
  }

  /**
   * Calculate next update time (next 9th minute of 10-minute cycle)
   */
  private calculateNextUpdateTime(from: Date): Date {
    const next = new Date(from);
    
    // Get current minutes
    const currentMinutes = next.getMinutes();
    
    // Calculate minutes until next 9th minute of 10-minute cycle
    // 9th minute cycle: 9, 19, 29, 39, 49, 59
    let targetMinute;
    if (currentMinutes < 9) targetMinute = 9;
    else if (currentMinutes < 19) targetMinute = 19;
    else if (currentMinutes < 29) targetMinute = 29;
    else if (currentMinutes < 39) targetMinute = 39;
    else if (currentMinutes < 49) targetMinute = 49;
    else if (currentMinutes < 59) targetMinute = 59;
    else {
      // Next hour, 9th minute
      next.setHours(next.getHours() + 1);
      targetMinute = 9;
    }
    
    next.setMinutes(targetMinute, 0, 0); // Set seconds and milliseconds to 0
    
    return next;
  }

  /**
   * Clear cache (for testing/debugging)
   */
  public clearCache(): void {
    this.cache = null;
    console.log('[CACHE] Cache cleared');
  }
}

// Singleton instance
export const advancedStationDataCache = new AdvancedStationDataCache();