import { logger } from '../utils/logger';
import { fetchStationById } from './stationService';
import { getLiveData } from './newLiveService';

export type LiveSchedulerStatus = {
  isRunning: boolean;
  intervalMs: number;
  enabledStationIds: number[];
};

class LiveDataScheduler {
  private enabled: Map<number, boolean> = new Map();
  private timer: NodeJS.Timeout | null = null;
  private readonly intervalMs = 5000; // every 5 seconds
  private readonly ttlSeconds = 10;   // consider cache fresh if <= 10s

  public start(): void {
    if (this.timer) return;
    logger.info('[LIVE] Starting live data scheduler', { intervalMs: this.intervalMs });
    this.timer = setInterval(() => this.tick(), this.intervalMs);
  }

  public stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      logger.info('[LIVE] Stopped live data scheduler');
    }
  }

  public setStationEnabled(stationId: number, enabled: boolean): void {
    if (!Number.isFinite(stationId)) return;
    this.enabled.set(stationId, enabled);
    logger.info('[LIVE] Station collection toggle', { stationId, enabled });
  }

  public getStatus(): LiveSchedulerStatus {
    return {
      isRunning: !!this.timer,
      intervalMs: this.intervalMs,
      enabledStationIds: Array.from(this.enabled.entries())
        .filter(([_, v]) => v)
        .map(([id]) => id),
    };
  }

  private async tick(): Promise<void> {
    const active = Array.from(this.enabled.entries()).filter(([_, v]) => v).map(([id]) => id);
    if (active.length === 0) return;
    logger.info('[LIVE] Scheduler tick', { activeCount: active.length, stationIds: active });
    for (const stationId of active) {
      try {
        const station = await fetchStationById(stationId);
        if (!station) {
          logger.warn('[LIVE] Station not found for live collection', { stationId });
          continue;
        }
        // Warm or refresh cache; getLiveData serves from cache if fresh (<= ttlSeconds)
        await getLiveData({
          ip_datalogger_http: station.ip_datalogger_http,
          ip: station.ip_modem_https?.split(':')[0],
          ip_modem_http: station.ip_modem_http,
          datalogger_http_port: station.datalogger_http_port,
        }, stationId, this.ttlSeconds);
      } catch (error) {
        logger.warn('[LIVE] Failed live collection for station', { stationId, error });
      }
    }
  }
}

export const liveDataScheduler = new LiveDataScheduler();
