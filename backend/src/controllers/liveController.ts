import { Request, Response } from "express";
import { logger } from "../utils/logger";
import * as newLiveService from "../services/newLiveService";
import { liveDataScheduler } from "../services/liveSchedulerService";


export async function getLiveData(req: Request, res: Response) {
    try {
        const ip_datalogger_http = req.query.ip_datalogger_http as string | undefined;
        const ip = req.query.ip as string | undefined;
        const ip_modem_http = req.query.ip_modem_http as string | undefined;
        const stationIdParam = req.query.stationId as string | undefined;
        const stationId = stationIdParam ? Number(stationIdParam) : undefined;
        const ttlSecondsParam = req.query.ttlSeconds as string | undefined;
        const ttlSeconds = ttlSecondsParam ? Number(ttlSecondsParam) : undefined;
        
        if (!ip_datalogger_http && !ip && !ip_modem_http) {
            return res.status(400).json({ error: 'At least one of ip_datalogger_http, ip, or ip_modem_http must be provided' });
        }

        const result = await newLiveService.getLiveData({
            ip_datalogger_http,
            ip,
            ip_modem_http,
        }, stationId, ttlSeconds);

        if ('error' in result) {
            return res.status(500).json({ error: result.error });
        }

        res.json(result);
    } catch (error) {
        logger.error('Error in getLiveData', { error });
        res.status(500).json({ error: 'Failed to fetch live data' });
    }
}

export async function enableLiveCollection(req: Request, res: Response) {
    const stationId = Number(req.params.stationId);
    if (!Number.isFinite(stationId)) return res.status(400).json({ error: 'Invalid station ID' });
    liveDataScheduler.setStationEnabled(stationId, true);
    res.json({ ok: true, stationId });
}

export async function disableLiveCollection(req: Request, res: Response) {
    const stationId = Number(req.params.stationId);
    if (!Number.isFinite(stationId)) return res.status(400).json({ error: 'Invalid station ID' });
    liveDataScheduler.setStationEnabled(stationId, false);
    res.json({ ok: true, stationId });
}

export async function getLiveSchedulerStatus(_req: Request, res: Response) {
    res.json(liveDataScheduler.getStatus());
}