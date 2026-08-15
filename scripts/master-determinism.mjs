// scripts/master-determinism.mjs
//
// Does the master build return the SAME record twice for the same CV text?
// Pulls the user's stored raw CV text out of Supabase, runs buildOrMergeMaster
// on it twice, and diffs the two outputs. Read-only against the DB — nothing is
// saved; the two builds are paid Gemini calls and their cost is printed.
//
//   doppler run -- node scripts/master-determinism.mjs <user_id|email>

import { createClient } from '@supabase/supabase-js';
import { buildOrMergeMaster } from '../utils/openai.js';

async function main() {
  const arg = process.argv[2];
  if (!arg) {
    console.error('usage: node scripts/master-determinism.mjs <user_id|email>');
    process.exit(1);
  }
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );

  let userId = arg;
  if (arg.includes('@')) {
    const { data } = await sb.from('users').select('user_id').eq('email', arg).single();
    if (!data) throw new Error(`no user for ${arg}`);
    userId = data.user_id;
  }

  const { data: row } = await sb
    .from('cv_data')
    .select('cv_data')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  const raw = row?.cv_data;
  if (!raw) throw new Error('no raw cv_text stored for this user');
  console.log(`raw CV text: ${raw.length} chars\n`);

  const runs = [];
  for (let i = 1; i <= 2; i++) {
    const { output, usages } = await buildOrMergeMaster(raw);
    const cost = (usages || []).reduce((t, u) => t + (u?.costUsd || 0), 0);
    console.log(`run ${i}: ${(output.work_experience || []).length} work_experience entries, cost $${cost.toFixed(4)}`);
    runs.push(output);
  }

  const [a, b] = runs.map(o => JSON.stringify(o, null, 2));
  if (a === b) {
    console.log('\nIDENTICAL — both builds produced byte-identical records.');
    return;
  }
  console.log('\nDIFFERENT — the two builds diverged.');
  const al = a.split('\n');
  const bl = b.split('\n');
  for (let i = 0; i < Math.max(al.length, bl.length); i++) {
    if (al[i] !== bl[i]) {
      console.log(`  line ${i + 1}:\n    run1: ${al[i] ?? '(none)'}\n    run2: ${bl[i] ?? '(none)'}`);
    }
  }
}

main().catch(e => { console.error(e); process.exit(1); });
