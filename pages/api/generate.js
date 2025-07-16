import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Only POST allowed' });
  }

  try {
    const {
      user_id,
      tone,
      job_title,
      company,
      source_cv_id,
      paid,
      model,
      content
    } = req.body;

    const gen_id = crypto.randomUUID();
    const event_type = paid ? 'completion' : 'cache';

    // Insert into gen_data
    await supabase.from('gen_data').insert([
      {
        id: gen_id,
        user_id,
        source_cv_id,
        type: event_type,
        tone: tone || null,
        company: company || null,
        job_title: job_title || null,
        file_name: null,
        content,
        created_at: new Date().toISOString(),
        expires_at: null,
        analysis_id: null,
        hr_contact: null,
        paid,
        paid_at: paid ? new Date().toISOString() : null
      }
    ]);

    // Get model cost
    const { data: pricing, error: pricingError } = await supabase
      .from('model_pricing')
      .select('cost_per_call')
      .eq('model', model)
      .eq('event_type', event_type)
      .single();

    const cost = pricing?.cost_per_call || 0;

    // Insert into transactions
    await supabase.from('transactions').insert([
      {
        user_id,
        type: 'ai_cost',
        source_gen_id: gen_id,
        model,
        amount_usd: cost,
        detail: JSON.stringify({ event: event_type }),
        created_at: new Date().toISOString()
      }
    ]);

    res.status(200).json({ success: true, gen_id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Logging failed' });
  }
}
