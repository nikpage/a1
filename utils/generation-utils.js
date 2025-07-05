// path: utils/generation-utils.js
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function getUserById(user_id) {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('user_id', user_id)
    .single();

  if (error) {
    console.error('Error fetching user:', error);
    return null;
  }
  return data;
}

export async function decrementGenerations(user_id, amount = 1) {
  const { error } = await supabase.rpc('decrement_generations', { user_id, amount });

  if (error) {
    console.error('Error decrementing generations:', error);
  }
}
