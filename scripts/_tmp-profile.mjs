import { createClient } from '@supabase/supabase-js';
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data: u } = await sb.from('users').select('user_id').eq('email','npx10111@gmail.com').single();
const { data } = await sb.from('cv_data').select('career_profile').eq('user_id', u.user_id).single();
console.log(JSON.stringify(data?.career_profile ?? null, null, 2));
