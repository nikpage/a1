// pages/api/log-transaction.js
import { createClient } from '@supabase/supabase-js';
import { KeyManager } from '../../utils/key-manager.js';

const keyManager = new KeyManager();
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  const {
    user_id,
    source_gen_id = null,
    model = 'DS-v3',
    cache_hit_tokens = 0,
    cache_miss_tokens = 0,
    completion_tokens = 0,
    job_title = null,
    company = null,
    tone = null,
    key_index = keyManager.currentKeyIndex
  } = req.body;

  if (!user_id || !model) {
    return res.status(400).json({ error: 'Missing user_id or model' });
  }

  const { data: pricing, error: pricingError } = await supabase
    .from('model_pricing')
    .select('event_type, cost_per_call')
    .eq('model', model);

  if (pricingError || !pricing || pricing.length === 0) {
    return res.status(500).json({ error: 'Failed to get pricing' });
  }

  const priceMap = pricing.reduce((acc, row) => ({
    ...acc,
    [row.event_type]: parseFloat(row.cost_per_call)
  }), {});

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
      key_index
    }
  ]);

  if (insertError) {
    return res.status(500).json({ error: 'Failed to save transaction' });
  }

  return res.status(200).json({ message: 'Transaction saved' });
}
