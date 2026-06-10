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

// Strict Fix for Railway Proxy Error
app.set('trust proxy', true); // <--- YEH LINE LAZMI LAGAYE KANFI

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false, 
  crossOriginEmbedderPolicy: false
}));

// Safe Rate Limiter
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 1000, 
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({ error: 'Too many requests, please try again later.' });
  }
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

// 🚀 CRITICAL FIX: Backend routes ko sub se PEHLE define kar rahe hain
app.use('/webhook', webhookRouter);
app.use('/api', apiRouter);

// Express ko batana ke static dist folder serve kare (Yeh niche hona chahiye)
app.use(express.static(path.join(__dirname, '../dist')));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString()
  });
});

// Forward frontend routing to index.html (Sub se aakhir me backup catch-all)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});

// Error handling
app.use(errorHandler);

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
});

export default app;
