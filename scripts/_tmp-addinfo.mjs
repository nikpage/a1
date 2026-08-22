import { createClient } from '@supabase/supabase-js';
import { augmentMaster } from '../utils/openai.js';
import { mergeAdditions } from '../utils/master-schema.js';
import { getMasterCv, saveMasterCv } from '../utils/database.js';
import { enterAiContext, setAiContext } from '../utils/ai-meter.js';

const TEXT = process.argv[2];
enterAiContext({ context: 'script:add-info', detail: 'owner AI history' });

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data } = await sb.from('users').select('user_id').eq('email','npx10111@gmail.com').single();
setAiContext({ user_id: data.user_id });

const master = await getMasterCv(data.user_id);
if (!master) throw new Error('no master');
const before = JSON.stringify(master);
const result = await augmentMaster(master, TEXT.trim());
const merged = mergeAdditions(master, result.output);
await saveMasterCv(data.user_id, merged);
console.log('saved. changed:', before !== JSON.stringify(merged));
console.log('cost:', result.usages.map(u => `${u.model} $${u.costUsd}`).join(', '));
