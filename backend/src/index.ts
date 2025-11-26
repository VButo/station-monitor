// Main Express app entry point
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { initSocket } from './utils/socket'
import stationRoutes from './routes/stationRoutes';
import userRoutes from './routes/userRoutes';
import smsRoutes from './routes/smsRoutes';
import overviewRoutes from './routes/overviewRoutes';
import { errorHandler } from './middleware/errorHandler';
import { advancedDataScheduler } from './services/schedulerService';

const app = express();
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

app.use((req, res, next) => {
  console.log(`[CORS DEBUG] ${req.method} ${req.originalUrl}`);
  console.log('Origin:', req.headers.origin);
  console.log('Credentials:', req.headers.cookie ? 'Yes' : 'No');
  next();
});

// Lax CORS for development: allow credentials and specific origin
const allowedOrigin = [
  process.env.SITE_URL || 'http://localhost:3000',
  'http://192.168.99.10:3000',   // External/exposed IP - primary
  'http://192.168.100.34:3000',  // Local network IP - backup
  'http://localhost:3000',        // Local development
  'http://192.168.10.1',           // Outside router IP
  'http://192.168.10.10:4001'      // Outside router IP
];
app.use(cors({
  origin: allowedOrigin,
  credentials: true,
}));
app.use(cookieParser());
// Example: use auth middleware globally
// app.use(authMiddleware);

app.use('/api/stations', stationRoutes);
app.use('/api/users', userRoutes);
app.use('/api', overviewRoutes);
app.use('/api/sms', smsRoutes);

// Error handler
app.use(errorHandler);

const PORT = process.env.PORT? Number.parseInt(process.env.PORT) : 4000;
const HOST = '0.0.0.0';

// Start the advanced data scheduler
console.log('Starting advanced data scheduler...');
advancedDataScheduler.start();

const server = app.listen(PORT, HOST, () => {
  console.log(`Backend server running on ${HOST}:${PORT}`);
  console.log(`Local access: http://localhost:${PORT}`);
  console.log(`Network access: http://192.168.100.34:${PORT}`); // Local network IP
  console.log(`External access: http://192.168.99.10:${PORT}`); // External-exposed IP
  console.log('Advanced data caching enabled - /api/stations/advanced-table serves cached data only');
  console.log('Data refreshes automatically every 10 minutes on the 9th minute (9, 19, 29, etc.)');

  // Initialize socket.io server (async)
  ;(async () => {
    try {
      await initSocket(server as unknown as import('http').Server, allowedOrigin)
      console.log('Socket.io initialized')
    } catch (e) {
      console.warn('Failed to initialize socket.io', e)
    }
  })()
})
