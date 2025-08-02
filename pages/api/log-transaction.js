// pages/api/log-transaction.js


import { createClient } from '@supabase/supabase-js';
import { KeyManager } from './key-manager.js'; // Assuming key-manager is in utils

const keyManager = new KeyManager();
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function logTransaction(data) {
  const {
    user_id,
    source_gen_id = null,
    model = 'DS-v3',
    // We now see the original file doesn't use prompt_tokens,
    // so we will match its logic exactly.
    cache_hit_tokens = 0,
    cache_miss_tokens = 0,
    completion_tokens = 0,
    job_title = null,
    company = null,
    tone = null,
    key_index = keyManager.currentKeyIndex // Pass key_index if available
  } = data;

  if (!user_id || !model) {
    console.error('logTransaction requires user_id and model');
    return;
  }

  // --- Logic from your log-transaction.js file ---
  const { data: pricing, error: pricingError } = await supabase
    .from('model_pricing')
    .select('event_type, cost_per_call')
    .eq('model', model);

  if (pricingError || !pricing || pricing.length === 0) {
    console.error('Pricing lookup failed:', pricingError);
    return; // Exit gracefully
  }

  const priceMap = {};
  for (const row of pricing) {
    priceMap[row.event_type] = parseFloat(row.cost_per_call);
  }

  const amount_usd = (
    cache_hit_tokens * (priceMap['cache_hit'] || 0) +
    cache_miss_tokens * (priceMap['cache_miss'] || 0) +
    completion_tokens * (priceMap['completion'] || 0)
  ).toFixed(12);

  const { error: insertError } = await supabase.from('transactions').insert([
    {
      user_id,
      type: 'ai_cost',
      source_gen_id,
      model,
      cache_hit_tokens,
      cache_miss_tokens,
      completion_tokens,
      amount_usd,
      detail: { job_title, company, tone },
      created_at: new Date().toISOString(),
      key_index: key_index
    }
  ]);

  if (insertError) {
    console.error('Transaction insert failed:', insertError);
  }
}
