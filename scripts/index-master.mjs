// scripts/index-master.mjs
//
// Build the retrieval index for a user who already has a master CV.
//
// The live path indexes the record when the master is BUILT (analyse-background),
// which is the moment it changes. An account whose master predates retrieval has
// no index and would silently keep generating from the whole record — the exact
// behaviour retrieval exists to replace, with nothing on screen to say so. This
// backfills it.
//
// One paid embedding call for the whole record; cents. Metered like any other
// spend, under a script:* context.
//
//   node scripts/index-master.mjs <user_id|email>
//   node scripts/index-master.mjs <user_id|email> --dry     (chunk only, no spend)

import { createClient } from '@supabase/supabase-js';
import { getMasterCv } from '../utils/database.js';
import { chunkMaster } from '../utils/cv-chunks.js';
import { indexMaster } from '../utils/cv-retrieval.js';
import { enterAiContext, setAiContext } from '../utils/ai-meter.js';

async function main() {
  const arg = process.argv[2];
  const dry = process.argv.includes('--dry');
  if (!arg) {
    console.error('usage: node scripts/index-master.mjs <user_id|email> [--dry]');
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
  setAiContext({ user_id: userId });

  const master = await getMasterCv(userId);
  if (!master) throw new Error('this user has no master CV to index');

  const chunks = chunkMaster(master);
  console.log(`${chunks.length} chunks from this record:\n`);

  const byKind = chunks.reduce((acc, c) => ({ ...acc, [c.kind]: (acc[c.kind] || 0) + 1 }), {});
  for (const [kind, n] of Object.entries(byKind)) console.log(`  ${String(n).padStart(4)}  ${kind}`);

  // Reading a sample is how a bad cut gets caught before it is embedded and
  // searched against for months.
  console.log('\nfirst five, as the writer will see them:\n');
  for (const c of chunks.slice(0, 5)) console.log(`  - ${c.text}`);

  if (dry) {
    console.log('\n--dry: nothing embedded, nothing written.');
    return;
  }

  const { count, gemini_usage } = await indexMaster(userId, master);
  console.log(`\nindexed ${count} chunks`);
  if (gemini_usage) {
    console.log(
      `[Gemini] model: ${gemini_usage.model}  in: ${gemini_usage.inputTokens}  ` +
      `out: ${gemini_usage.outputTokens}  cost: $${(gemini_usage.costUsd ?? 0).toFixed(6)}`
    );
  }
}

enterAiContext({ context: 'script:index-master' });
main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
