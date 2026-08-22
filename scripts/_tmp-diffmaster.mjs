import { getMasterCv } from '../utils/database.js';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data: u } = await sb.from('users').select('user_id').eq('email','npx10111@gmail.com').single();
const master = await getMasterCv(u.user_id);
fs.writeFileSync('/tmp/claude-1000/-home-nik-repos-a1/ec6887eb-264a-40de-920a-7eec9722ce5f/scratchpad/db-master.json', JSON.stringify(master, null, 2) + '\n');
console.log('written');
