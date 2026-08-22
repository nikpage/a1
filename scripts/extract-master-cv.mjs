import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const { data: userData, error: userError } = await sb
  .from('users')
  .select('user_id')
  .eq('email', 'npx10111@gmail.com')
  .single();

if (userError || !userData) {
  console.error('User not found');
  process.exit(1);
}

const { data: cvData, error: cvError } = await sb
  .from('cv_data')
  .select('master_cv')
  .eq('user_id', userData.user_id)
  .single();

if (cvError || !cvData?.master_cv) {
  console.error('No master_cv found');
  process.exit(1);
}

console.log(JSON.stringify(cvData.master_cv, null, 2));
