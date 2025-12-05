// Centralized error handling middleware
import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

interface HttpError extends Error {
  status?: number;
  statusCode?: number;
}

export function errorHandler(err: HttpError, req: Request, res: Response, _next: NextFunction) {
  const statusCode = err.status ?? err.statusCode ?? 500;
  const requestId = (res.locals as Record<string, string | undefined>).requestId;

  logger.error('Request failed', {
    method: req.method,
    path: req.originalUrl,
    statusCode,
    requestId,
    ip: req.ip,
    userId: (req as any).user?.id,
    message: err.message,
    stack: process.env.NODE_ENV === 'production' ? undefined : err.stack,
  });

  res.status(statusCode).json({
    error: statusCode >= 500 ? 'Internal Server Error' : err.message,
    requestId,
  });
}
