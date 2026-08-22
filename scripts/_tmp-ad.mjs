import { writeFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data: u } = await sb.from('users').select('user_id').eq('email','npx10111@gmail.com').single();
const { data } = await sb.from('gen_data').select('content').eq('user_id', u.user_id).eq('type','analysis').order('created_at',{ascending:false}).limit(1);
const c = typeof data[0].content === 'string' ? JSON.parse(data[0].content) : data[0].content;
writeFileSync('runs/invity-ad.txt', c.job_text);
console.log('wrote', c.job_text.length, 'chars');
