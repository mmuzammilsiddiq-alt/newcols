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
import { createClient } from '@supabase/supabase-js'; // <--- Testing ke liye import kiya

dotenv.config();

const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 3000;

// Supabase temporary client setup for testing
const supabaseTestClient = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || ''
);

// Trust Railway Proxy
app.set('trust proxy', 1);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false, 
  crossOriginEmbedderPolicy: false
}));

// Safe Rate Limiter
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 500, 
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

// Express ko batana ke baher pada hua 'dist' folder serve kare
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

// 🚀 DEDICATED DATABASE TESTING ROUTE (NEW)
app.get('/api/db-test', async (req, res) => {
  try {
    // 1. Database se simple query fetch karke connection check karte hain
    const startTime = Date.now();
    
    // Aapke system ke 'agents' ya kisi bhi table se test read letay hain
    const { data: readData, error: readError } = await supabaseTestClient
      .from('agents')
      .select('count', { count: 'exact', head: true });

    if (readError) throw readError;
    
    const duration = Date.now() - startTime;

    // 2. Agar connection perfect hai to screen par response bhejte hain
    res.json({
      database_connection: "SUCCESS ✅",
      status: "Database is fully connected and responding!",
      response_time: `${duration}ms`,
      timestamp: new Date().toISOString(),
      details: {
        supabase_url_configured: !!process.env.SUPABASE_URL,
        supabase_key_configured: !!process.env.SUPABASE_SERVICE_KEY,
        total_agents_tracked: readData || "Connected but table metadata structural"
      }
    });

  } catch (error) {
    logger.error('❌ Database Test Route Failed:', error);
    res.status(500).json({
      database_connection: "FAILED ❌",
      status: "Could not write or read from database.",
      error_message: error.message || error,
      help: "Check if your SUPABASE_SERVICE_KEY or SUPABASE_URL variables are identical to your Supabase project dashboard."
    });
  }
});

// Routes
app.use('/webhook', webhookRouter);
app.use('/api', apiRouter);

// Forward frontend routing to index.html
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/webhook')) {
    return next();
  }
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});

// Error handling
app.use(errorHandler);

// 404 handler for API
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

export default app;
