import { createClient } from '@supabase/supabase-js';
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data: u } = await sb.from('users').select('user_id').eq('email','npx10111@gmail.com').single();
const { data } = await sb.from('cv_data').select('cv_text, extracted_text, updated_at, created_at').eq('user_id', u.user_id).single();
console.log(JSON.stringify(Object.fromEntries(Object.entries(data).map(([k,v])=>[k, typeof v==='string'? v.length+' chars':v])), null, 2));
const t = data.cv_text || data.extracted_text || '';
console.log('---AI/2024/2025 mentions---');
for (const line of t.split('\n')) if (/\bAI\b|2023|2024|2025|LLM|GPT|Claude/i.test(line)) console.log(line.trim());
