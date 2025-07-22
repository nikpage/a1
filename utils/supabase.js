import { createClient } from '@supabase/supabase-js';

// Ensure your environment variables are named correctly in your .env.local file
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Create and export a single, shared client instance
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
