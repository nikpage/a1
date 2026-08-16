import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const { data, error } = await supabase
  .from('transactions')
  .select('created_at, model, amount_usd, cache_miss_tokens, completion_tokens, thinking_tokens, detail, source_gen_id')
  .eq('type', 'ai_cost')
  .gte('created_at', new Date(Date.now() - 8 * 86400000).toISOString())
  .order('created_at', { ascending: true });

if (error) { console.error(error); process.exit(1); }

const byDay = {};
for (const row of data) {
  const day = row.created_at.slice(0, 10);
  byDay[day] ??= { total: 0, count: 0, byModel: {}, byGen: new Set() };
  byDay[day].total += Number(row.amount_usd);
  byDay[day].count += 1;
  byDay[day].byGen.add(row.source_gen_id);
  const m = row.model || 'unknown';
  byDay[day].byModel[m] ??= { total: 0, count: 0 };
  byDay[day].byModel[m].total += Number(row.amount_usd);
  byDay[day].byModel[m].count += 1;
}

for (const day of Object.keys(byDay).sort()) {
  const d = byDay[day];
  console.log(`\n${day}  total=$${d.total.toFixed(4)}  calls=${d.count}  distinct_gen_ids=${d.byGen.size}`);
  for (const [m, v] of Object.entries(d.byModel).sort((a,b)=>b[1].total-a[1].total)) {
    console.log(`   ${m.padEnd(30)} $${v.total.toFixed(4).padStart(9)}  n=${v.count}`);
  }
}

console.log('\n--- Aug 15 detail ---');
const aug15 = data.filter(r => r.created_at.startsWith('2026-08-15'));
for (const r of aug15) {
  console.log(r.created_at.slice(11,19), r.model.padEnd(22), ('$'+Number(r.amount_usd).toFixed(4)).padStart(9),
    'in='+r.cache_miss_tokens, 'out='+r.completion_tokens, 'think='+r.thinking_tokens,
    JSON.stringify(r.detail), r.source_gen_id);
}

const { data: pricing } = await supabase.from('model_pricing').select('*');
console.log('\n--- model_pricing ---');
console.log(pricing);
