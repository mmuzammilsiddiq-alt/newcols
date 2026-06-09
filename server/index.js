import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import dotenv from 'dotenv';
import { createServer } from 'http';
import path from 'path'; // <--- NEW: Path module import kiya
import { fileURLToPath } from 'url'; // <--- NEW: URL module import kiya
import webhookRouter from './routes/webhook.js';
import apiRouter from './routes/api.js';
import { initializeRealtimeSubscriptions } from './services/realtime.js';
import logger from './utils/logger.js';
import { errorHandler } from './middleware/errorHandler.js';
import rateLimit from 'express-rate-limit';

dotenv.config();

const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 3000;

// NEW: __dirname setup kiya ESM modules ke liye
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false, // Allow Supabase connections
  crossOriginEmbedderPolicy: false
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: 'Too many requests from this IP, please try again later.'
});

app.use('/api/', limiter);

// CORS configuration
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Compression
app.use(compression());

// NEW: 1. Express ko batana ke baher pada hua 'dist' (frontend static files) folder serve kare
app.use(express.static(path.join(__dirname, '../dist')));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV
  });
});

// Routes
app.use('/webhook', webhookRouter);
app.use('/api', apiRouter);

// NEW: 2. Kisi bhi normal frontend route (jaise /, /login) par index.html bhej dena
app.get('*', (req, res, next) => {
  // Agar koi request API ki taraf ja rahi hai jo server me nahi mili, to use agey jaane dein taake 404 handler response de
  if (req.path.startsWith('/api') || req.path.startsWith('/webhook')) {
    return next();
  }
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});

// Error handling
app.use(errorHandler);

// 404 handler (Ab yeh sirf galat API routes par chalega)
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Initialize Supabase Realtime subscriptions
initializeRealtimeSubscriptions()
  .then(() => {
    logger.info('✅ Supabase Realtime subscriptions initialized');
  })
  .catch((error) => {
    logger.error('❌ Failed to initialize Realtime subscriptions:', error);
  });

// Start server
server.listen(PORT, '0.0.0.0', () => {
  logger.info(`🚀 MessengerFlow Server running on port ${PORT}`);
  logger.info(`📡 Environment: ${process.env.NODE_ENV}`);
  logger.info(`🔗 Supabase URL: ${process.env.SUPABASE_URL}`);
  logger.info(`⚡ Real-time mode: ACTIVE (0ms delay)`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT signal received: closing HTTP server');
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
});

// Unhandled rejection handler
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

export default app;
