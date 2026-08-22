import { createClient } from '@supabase/supabase-js';
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data: u } = await sb.from('users').select('user_id').eq('email','npx10111@gmail.com').single();
const { data } = await sb.from('cv_data').select('*').eq('user_id', u.user_id).single();
const cols = Object.keys(data).filter(k=>/profile/i.test(k));
console.log('cols', cols);
for (const c of cols) {
  const v = typeof data[c]==='string'?JSON.parse(data[c]):data[c];
  if (v && v.proven_keywords) console.log(c, 'PROVEN:', JSON.stringify(v.proven_keywords.map(k=>k.term||k)));
  if (v && v.transferable_skills) console.log(c, 'TRANSFER:', v.transferable_skills);
}
