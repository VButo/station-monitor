// Supabase client for backend (no cookies/session handling)
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false, // Don't persist session on backend
    autoRefreshToken: false, // Don't auto-refresh tokens on backend
  },
  global: {
    headers: {
      'cache-control': 'no-cache', // Prevent caching issues
    },
  },
});

// Helper function to create a fresh client if needed
export function createFreshSupabaseClient() {
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: {
        'cache-control': 'no-cache',
      },
    },
  });
}
