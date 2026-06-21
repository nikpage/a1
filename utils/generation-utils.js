// path: utils/generation-utils.js
import { createClient } from '@supabase/supabase-js';
import { logger } from '../lib/logger.js';

let _supabase;
function getSupabase() {
  if (!_supabase) _supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  return _supabase;
}
const supabase = new Proxy({}, { get: (_, prop) => getSupabase()[prop] });

export async function getUserById(user_id) {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('user_id', user_id)
    .single();

  if (error) {
    logger.error('Error fetching user:', error.message);
    return null;
  }
  return data;
}

export async function decrementGenerations(user_id, amount = 1) {
  const { error } = await supabase.rpc('decrement_generations', { user_id, amount });

  if (error) {
    logger.error('Error decrementing generations:', error.message);
  }
}
