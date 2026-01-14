import { Request, Response } from 'express';
import * as smsService from '../services/smsService';
import { getIo } from '../utils/socket';
import { logger } from '../utils/logger';


export async function smsRecieved(req: Request, res: Response) {
    try {
        const { number, message } = req.body;
        logger.info('Inbound SMS received', { number });
        // Here you can add logic to process the SMS message as needed
        if (!number || !message) {
            return res.status(400).json({ error: 'Missing number or message in request body' });
        }
        console.log("Recieved SMS:", number, "with message:", message);
        const responseMessage = await smsService.smsRecieved(number, message);
        try {
            const io = getIo()
            io.to(`station:${responseMessage.station_id}`).emit('sms:new', responseMessage)
        } catch (e) {
            logger.warn('Failed to emit socket event sms:new in smsRecieved', { error: e });
        }
        res.status(200).json({ success: true, message: responseMessage });
    }
    catch (error) {
        logger.error('Error in smsRecieved controller', { error });
        res.status(500).json({ error: 'Internal server error' });
    }
}

export async function sendToDevice(req: Request, res: Response) {
    try {
        const { number, message, station_id } = req.body;
        if (!number || !message) {
            return res.status(400).json({ error: 'Missing number or message' });
        }

                                // Extract token helper (from Authorization Bearer or cookie)
                                async function resolveUserIdFromRequest(): Promise<string | null> {
                                    const authHeader = req.headers.authorization ?? ''
                                    let token: string | null = null
                                    if (authHeader.startsWith('Bearer ')) token = authHeader.slice(7)
                                    if (!token) token = req.cookies?.['supabase-token'] ?? null
                                    if (!token) return null
                                    try {
                                        const { UserService } = await import('../services/userService')
                                        const svc = new UserService()
                                        const u = await svc.getUser(token)
                                        return u?.id ?? null
                                    } catch (e) {
                                        logger.warn('Failed to decode auth token in sendToDevice', { error: e })
                                        return null
                                    }
                                }

                                const userId = await resolveUserIdFromRequest()

        // Insert outgoing message (OUTBOX = 2)
        const inserted = await smsService.insertOutgoingSms({
            station_id: station_id ?? null,
            user_id: userId,
            number,
            message,
            status: 2,
            time: new Date().toISOString(),
            unread: false,
            deleted: false,
            retry_number: 0,
        });

        // Broadcast new outgoing message to connected clients (optimistic)
        try {
            const io = getIo()
            io.to(`station:${inserted.station_id}`).emit('sms:new', inserted)
        } catch (e) {
            logger.warn('Failed to emit socket event sms:new in sendToDevice', { error: e });
        }

        // Attempt to send to device
        const result = await smsService.sendSmsToDevice(number, message);
        // Update status based on result: 3=SENT, 4=UNSENT
        try {
            const newStatus = result.ok ? 3 : 4;
                    if (inserted?.id) {
                        await smsService.updateSmsStatus(inserted.id, newStatus);
                        try {
                            const io = getIo()
                            io.to(`station:${inserted.station_id}`).emit('sms:update', { id: inserted.id, status: newStatus })
                        } catch (e) {
                            logger.warn('Failed to emit socket event sms:update in sendToDevice', { error: e });
                        }
                    }
        } catch (e) {
            logger.warn('Failed to update SMS status', { error: e });
        }

        res.status(200).json({ success: result.ok, url: result.url, status: result.status ?? null, error: result.error ?? null, insertedId: inserted?.id ?? null });
    } catch (err) {
        logger.error('Error in sendToDevice controller', { error: err });
        res.status(500).json({ error: 'Internal server error' });
    }
}

export async function getMessagesByStation(req: Request, res: Response) {
    try {
        const stationId = Number(req.params.stationId);
        if (Number.isNaN(stationId)) return res.status(400).json({ error: 'Invalid stationId' });
        const rows = await smsService.getMessagesForStation(stationId);
                res.status(200).json({ success: true, data: rows });
    } catch (err) {
        logger.error('Error in getMessagesByStation', { error: err });
        res.status(500).json({ error: 'Internal server error' });
    }
}

export async function getUsernamesForMessages(req: Request, res: Response) {
    try {
        const { userIds } = req.body;
        if (!Array.isArray(userIds)) return res.status(400).json({ error: 'userIds must be an array' });
        const { UserService } = await import('../services/userService');
        const svc = new UserService();
        const rows = await svc.getUsersByIds(userIds.filter(Boolean));
        const map: Record<string, string | null> = {};
            for (const r of rows) {
                map[r.id] = r.email
            }
        res.status(200).json({ success: true, data: map });
    } catch (err) {
        logger.error('Error in getUsernamesForMessages', { error: err });
        res.status(500).json({ error: 'Internal server error' });
    }
}