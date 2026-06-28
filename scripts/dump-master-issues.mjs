// scripts/dump-master-issues.mjs
//
// One-shot diagnostic: does the master build actually POPULATE conflicts/gaps on
// real uploads, or do they come back empty (like master_flags did)? Reads the
// stored master_cv straight from Supabase and WRITES the result to
// /home/nik/repos/a1/master-dump.txt so nothing has to be copied or redirected.
//
//   doppler run -- node scripts/dump-master-issues.mjs <user_id|email>
//
// With no arg it lists the 5 most-recently-created masters. Read-only.

import { writeFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

const OUT = '/home/nik/repos/a1/master-dump.txt';
const lines = [];
const log = (s = '') => lines.push(String(s));

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    log('Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY — run via `doppler run -- node ...`.');
    return;
  }
  const sb = createClient(url, key, { auth: { persistSession: false } });
  const arg = process.argv[2];

  const summarise = (master) => {
    if (!master) return '  (no master_cv)';
    const exp = Array.isArray(master.experience) ? master.experience.length : 0;
    const conflicts = Array.isArray(master.conflicts) ? master.conflicts : [];
    const gaps = Array.isArray(master.gaps) ? master.gaps : [];
    const out = [`  experience roles: ${exp}`, `  conflicts: ${conflicts.length}`];
    if (conflicts.length) out.push(JSON.stringify(conflicts, null, 2).replace(/^/gm, '    '));
    out.push(`  gaps: ${gaps.length}`);
    if (gaps.length) out.push(JSON.stringify(gaps, null, 2).replace(/^/gm, '    '));
    return out.join('\n');
  };

  let userId = arg || null;
  if (arg && arg.includes('@')) {
    const { data, error } = await sb.from('users').select('user_id, email').eq('email', arg).limit(1);
    if (error) { log(`users lookup error: ${error.message}`); return; }
    userId = data?.[0]?.user_id || null;
    if (!userId) { log(`No user found for email "${arg}".`); return; }
  }

  if (userId) {
    const { data, error } = await sb.from('cv_data').select('user_id, master_cv, created_at').eq('user_id', userId).limit(1);
    if (error) { log(`cv_data error: ${error.message}`); return; }
    if (!data?.length) { log(`No cv_data row for user ${userId}.`); return; }
    log(`user_id: ${userId}  (created ${data[0].created_at})`);
    log(summarise(data[0].master_cv));
  } else {
    const { data, error } = await sb
      .from('cv_data')
      .select('user_id, master_cv, created_at')
      .order('created_at', { ascending: false })
      .limit(5);
    if (error) { log(`cv_data error: ${error.message}`); return; }
    for (const row of data || []) {
      log(`\n=== user ${row.user_id}  (created ${row.created_at}) ===`);
      log(summarise(row.master_cv));
    }
  }
}

try {
  await main();
} catch (e) {
  log(`FATAL: ${e?.stack || e?.message || e}`);
}
writeFileSync(OUT, lines.join('\n') + '\n');
console.log(`Wrote ${OUT}`);
