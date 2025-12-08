import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// DEBUG: Log what values Vite is seeing
console.log('ENV DEBUG:', {
  url: supabaseUrl,
  keyPrefix: supabaseAnonKey?.slice(0, 20),
  urlType: typeof supabaseUrl,
});

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);

// Expose Supabase client globally for migration scripts (browser console)
declare global {
  interface Window {
    __SUPABASE_CLIENT__?: SupabaseClient<Database>;
  }
}

if (typeof window !== 'undefined') {
  window.__SUPABASE_CLIENT__ = supabase;
}
