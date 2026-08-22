import { createClient } from '@supabase/supabase-js';
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth:{persistSession:false} });
const { data: u } = await sb.from('users').select('user_id').eq('email','npx10111@gmail.com').single();
const { data } = await sb.from('cv_data').select('voice_profile').eq('user_id', u.user_id).single();
const vp = data?.voice_profile;
if (!vp) { console.log('voice_profile: NULL — gone'); process.exit(0); }
console.log('voice_profile: PRESENT');
console.log('updated_at:', vp.updated_at);
console.log('samples:', (vp.samples||[]).length);
(vp.samples||[]).forEach((s,i)=>console.log(`  ${i+1}: ${s.text.length} chars :: ${JSON.stringify(s.text.slice(0,70))}`));
console.log('list_a:', (vp.list_a||[]).length, 'list_b:', (vp.list_b||[]).length, 'registers:', (vp.registers||[]).length);
