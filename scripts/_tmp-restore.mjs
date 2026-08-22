import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import { saveMasterCv } from '../utils/database.js';
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data } = await sb.from('users').select('user_id').eq('email','npx10111@gmail.com').single();
const master = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
await saveMasterCv(data.user_id, master);
console.log('restored:', master.work_experience.length, 'top-level roles');
