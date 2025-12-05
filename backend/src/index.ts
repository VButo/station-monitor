// Main Express app entry point
import express, { RequestHandler } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { randomUUID } from 'crypto';
import { initSocket } from './utils/socket'
import { logger } from './utils/logger';
import stationRoutes from './routes/stationRoutes';
import userRoutes from './routes/userRoutes';
import smsRoutes from './routes/smsRoutes';
import overviewRoutes from './routes/overviewRoutes';
import { errorHandler } from './middleware/errorHandler';
import { advancedDataScheduler } from './services/schedulerService';
import { advancedStationDataCache } from './services/cacheService';
import { authMiddleware } from './middleware/authMiddleware';

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', Number(process.env.TRUST_PROXY ?? 1));

app.use((req, res, next) => {
  const requestId = randomUUID();
  (res.locals as Record<string, string>).requestId = requestId;
  res.setHeader('X-Request-Id', requestId);
  next();
});

app.use(express.urlencoded({ extended: false, limit: '1mb' }));
app.use(express.json({ limit: '1mb' }));
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: false,
}));

const fallbackOrigins = [
  process.env.SITE_URL || '',
  'http://localhost:3000',
  'http://192.168.99.10:3000',
  'http://192.168.100.34:3000',
  'http://192.168.10.1',
  'http://192.168.10.10:4001',
];

const envOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const allowedOrigins = Array.from(new Set([...envOrigins, ...fallbackOrigins])).filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    // Log the rejected origin to aid diagnosis
    logger.warn('CORS: Origin not allowed', { origin, allowedOrigins });
    return callback(new Error(`Origin not allowed: ${origin}`));
  },
  credentials: true,
}));
app.use(compression());

const apiRateLimiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS ?? 15 * 60 * 1000),
  max: Number(process.env.RATE_LIMIT_MAX ?? 600),
  standardHeaders: true,
  legacyHeaders: false,
});

const loginRateLimiter = rateLimit({
  windowMs: Number(process.env.LOGIN_RATE_LIMIT_WINDOW_MS ?? 5 * 60 * 1000),
  max: Number(process.env.LOGIN_RATE_LIMIT_MAX ?? 50),
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many login attempts. Please try again later.',
});

app.use(cookieParser());

app.get('/healthz', (_req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

const shouldRunScheduler = process.env.RUN_SCHEDULER !== 'false';

app.get('/readyz', (_req, res) => {
  const schedulerStatus = advancedDataScheduler.getStatus();
  const cacheStatus = advancedStationDataCache.getStatus();
  const isReady = !shouldRunScheduler || (schedulerStatus.isRunning && cacheStatus.hasData);

  res.status(isReady ? 200 : 503).json({
    status: isReady ? 'ready' : 'starting',
    schedulerEnabled: shouldRunScheduler,
    scheduler: schedulerStatus,
    cache: cacheStatus,
  });
});

app.use('/api', apiRateLimiter);
app.use('/api/users/login', loginRateLimiter);

const shouldEnforceAuth = process.env.ENABLE_AUTH_MIDDLEWARE === 'true';
const passthroughAuth: RequestHandler = (_req, _res, next) => next();
const requireAuth: RequestHandler = shouldEnforceAuth ? authMiddleware : passthroughAuth;

const protectedApi = express.Router();
protectedApi.use(requireAuth);
protectedApi.use('/stations', stationRoutes);
protectedApi.use('/sms', smsRoutes);
protectedApi.use('/', overviewRoutes);

app.use('/api/users', userRoutes);
app.use('/api', protectedApi);

// Error handler
app.use(errorHandler);

const PORT = process.env.PORT? Number.parseInt(process.env.PORT) : 4000;
const HOST = '0.0.0.0';

// Start the advanced data scheduler if enabled
if (shouldRunScheduler) {
  logger.info('Starting advanced data scheduler...');
  advancedDataScheduler.start();
} else {
  logger.warn('RUN_SCHEDULER=false; skipping advanced data scheduler start.');
}

const server = app.listen(PORT, HOST, () => {
  logger.info('Backend server running', {
    host: HOST,
    port: PORT,
    local: `http://localhost:${PORT}`,
    network: `http://192.168.100.34:${PORT}`,
    external: `http://192.168.99.10:${PORT}`,
  });
  logger.info('Advanced data caching enabled - /api/stations/advanced-table serves cached data only');
  logger.info('Data refresh cadence: every 10 minutes on the 9th minute');

  // Initialize socket.io server (async)
  ;(async () => {
    try {
      await initSocket(server as unknown as import('http').Server, allowedOrigins)
      logger.info('Socket.io initialized')
    } catch (e) {
      logger.warn('Failed to initialize socket.io', { error: e })
    }
  })()
})

// Graceful shutdown handling
function shutdown(signal: string) {
  logger.warn(`Received ${signal}, shutting down gracefully...`)
  try {
    if (shouldRunScheduler) {
      try { advancedDataScheduler.stop() } catch (e) { logger.warn('Failed stopping scheduler', { error: e }) }
    }
    server.close((err?: Error) => {
      if (err) {
        logger.error('Error closing HTTP server', { error: err })
        process.exit(1)
      } else {
        logger.info('HTTP server closed')
        process.exit(0)
      }
    })
    // Fallback in case close hangs
    setTimeout(() => {
      logger.warn('Forcing shutdown after timeout')
      process.exit(1)
    }, 10000).unref()
  } catch (e) {
    logger.error('Unexpected error during shutdown', { error: e })
    process.exit(1)
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))
