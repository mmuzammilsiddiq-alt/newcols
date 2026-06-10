import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import logger from '../utils/logger.js';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  logger.error('❌ Missing Supabase configuration in environment variables');
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_KEY are required');
}

// ✨ REALTIME BYPASS STUB: Sockets crash rokne ke liye custom bypass function
const bypassRealtime = {
  createClient: () => ({
    setAuth: () => {},
    channel: () => ({
      subscribe: () => ({ receive: () => {} }),
      unsubscribe: () => {}
    }),
    removeChannel: () => {},
    removeAllChannels: () => {},
    disconnect: () => {},
    connect: () => {}
  })
};

// 1. Service role client (Bypassed Realtime)
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  },
  realtime: bypassRealtime // 🚀 Force Bypass
});

// 2. Anon client (Bypassed Realtime)
export const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: bypassRealtime // 🚀 Force Bypass (Masla yahan phas raha tha!)
});

// Test connection
export async function testConnection() {
  try {
    const { data, error } = await supabaseAdmin
      .from('agents')
      .select('id')
      .limit(1);
    
    if (error) throw error;
    
    logger.info('✅ Supabase connection successful');
    return true;
  } catch (error) {
    logger.error('❌ Supabase connection failed:', error.message);
    return false;
  }
}

// Initialize connection test
testConnection();

export default supabaseAdmin;
