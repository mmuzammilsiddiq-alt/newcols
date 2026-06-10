import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import dotenv from 'dotenv';
import { createServer } from 'http';
import path from 'path'; 
import { fileURLToPath } from 'url'; 
import webhookRouter from './routes/webhook.js';
import apiRouter from './routes/api.js';
import { initializeRealtimeSubscriptions } from './services/realtime.js';
import logger from './utils/logger.js';
import { errorHandler } from './middleware/errorHandler.js';
import rateLimit from 'express-rate-limit';

dotenv.config();

const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 8080;

// Railway proxy settings check bypass logic
app.set('trust proxy', 1); 

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false, 
  crossOriginEmbedderPolicy: false
}));

// Professional Rate Limiter without strict validation crashes
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Safe threshold
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false }, // 👈 ERROR FIX: Strict headers validation crash ko disable kar diya
  handler: (req, res) => {
    res.status(429).json({ error: 'Too many requests, please try again later.' });
  }
});

// Apply rate limiting securely to API endpoints
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

// Backend routing validation priority
app.use('/webhook', webhookRouter);
app.use('/api', apiRouter);

// Express static path mapping for frontend
app.use(express.static(path.join(__dirname, '../dist')));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString()
  });
});

// Single Page Application (SPA) catch-all fallback routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});

// Error handling middleware infrastructure
app.use(errorHandler);

// Initialize Supabase Realtime subscriptions
initializeRealtimeSubscriptions()
  .then(() => {
    logger.info('✅ Supabase Realtime subscriptions initialized');
  })
  .catch((error) => {
    logger.error('❌ Failed to initialize Realtime subscriptions:', error);
  });

// Run server listener engine
server.listen(PORT, '0.0.0.0', () => {
  logger.info(`🚀 MessengerFlow Server running on port ${PORT}`);
});

export default app;
