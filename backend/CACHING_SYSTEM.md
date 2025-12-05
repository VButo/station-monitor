# Advanced Station Data Caching System

## Overview

The advanced station data caching system optimizes performance by fetching station data from the database every 10 minutes on the 9th minute (9, 19, 29, 39, 49, 59 minutes of each hour) and serving **only** cached data to API requests. There is no database fallback - the API serves cached data exclusively.

## Architecture

### Components

1. **Cache Service** (`cacheService.ts`)
   - In-memory storage for advanced station data
   - Tracks cache metadata (hits, fetch times, freshness)
   - Automatic staleness detection

2. **Scheduler Service** (`schedulerService.ts`)
   - Cron-based periodic data fetching
   - Runs every 10 minutes on the 9th minute
   - Automatic retry and error handling

3. **Simplified API Controller** (`stationController.ts`)
   - Returns cached data when available
   - Returns 503 "Service Unavailable" if no cache
   - No database fallback

## API Endpoint

### Primary Data Endpoint
- `GET /api/stations/advanced-table` - Returns cached station data only

**Response Scenarios:**
- **Cache Hit**: Returns data with 200 OK
- **Cache Miss**: Returns 503 Service Unavailable with retry instructions

## Caching Schedule

The system runs on a 10-minute cycle:
- **Schedule**: 9, 19, 29, 39, 49, 59 minutes of every hour
- **Timezone**: UTC (to avoid timezone issues)
- **Initial Fetch**: Runs 2 seconds after server startup

## Performance Benefits

### Before Caching
- Each API request: 20+ database queries
- Response time: 5-30 seconds
- Database load: High on each request

### After Caching
- Each API request: Instant (cached data only)
- Response time: <100ms
- Database load: Only every 10 minutes
- Data freshness: Maximum 10 minutes old

## Response Format

### Successful Response (Cache Hit)
```json
{
  "stations": [...], 
  "columnStructure": {...},
  "metadata": {
    "publicKeys": [...],
    "statusKeys": [...],
    "measurementKeys": [...],
    "totalStations": 150,
    "generatedAt": "2025-09-23T10:09:00.000Z"
  }
}
```

### Cache Miss Response (503)
```json
{
  "error": "Data not available yet",
  "message": "Advanced station data is being fetched. Please try again in a few moments.",
  "retry_after": 30,
  "cache_status": {
    "hasData": false,
    "isFresh": false,
    "metadata": {...}
  }
}
```

## Error Handling

1. **Cache Miss**: Returns 503 with retry instructions
2. **Scheduler Failure**: Cache becomes stale but continues serving data
3. **Database Errors**: No data served until next successful fetch
4. **Startup**: Initial fetch runs immediately, API available after first fetch

## Configuration

### Environment Variables
- `RUN_SCHEDULER` (default `true`): set to `false` on any replica or worker where the cron job should stay idle. Only one process in the cluster should run the scheduler to avoid duplicate database load.
- Reuses the existing Supabase environment variables for data fetching.

### Customization Options
- **Cache Duration**: Modify cron schedule in `schedulerService.ts`
- **Client Cache**: 5-minute browser cache via Cache-Control headers

## Usage in Production

> **Single-worker requirement:** run the advanced scheduler in exactly one backend instance (or container). If you horizontally scale the API, set `RUN_SCHEDULER=false` on the extra replicas so they serve cached data without triggering duplicate cron jobs.

### Frontend Handling
```javascript
const fetchAdvancedData = async () => {
  try {
    const response = await fetch('/api/stations/advanced-table');
    
    if (response.status === 503) {
      // Cache miss - retry after delay
      setTimeout(fetchAdvancedData, 30000); // Retry in 30 seconds
      return null;
    }
    
    return await response.json();
  } catch (error) {
    console.error('Failed to fetch advanced data:', error);
    return null;
  }
};
```

### Expected Behavior
1. **First 2 seconds after startup**: API returns 503
2. **After initial fetch**: API returns cached data instantly
3. **Every 10 minutes**: Cache refreshes automatically
4. **No manual intervention needed**

## Development

### Testing Cache-Only Behavior
```bash
# Should return cached data (200 OK)
curl http://localhost:4000/api/stations/advanced-table

# During startup (before first fetch) - should return 503
curl http://localhost:4000/api/stations/advanced-table
```

### Logs to Monitor
- `[CACHE]` - Cache operations
- `[SCHEDULER]` - Cron job execution  
- Station controller cache hits/misses
- 503 responses when cache is empty

## Key Differences from Standard Caching

- **No Fallback**: Never hits database on API requests
- **Predictable Performance**: Always fast response (cache hit) or clear error (503)
- **Simplified Architecture**: No cache management endpoints needed
- **Background Processing**: All heavy database work happens in background