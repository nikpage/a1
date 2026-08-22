import { createClient } from '@supabase/supabase-js';
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data: u } = await sb.from('users').select('user_id').eq('email','npx10111@gmail.com').single();
const { data, error } = await sb.from('gen_data').select('type, content, created_at').eq('user_id', u.user_id).eq('type','cover_letter').order('created_at', { ascending: false }).limit(1);
if (error) throw error;
console.log(data?.[0]?.created_at);
console.log(data?.[0]?.content);
