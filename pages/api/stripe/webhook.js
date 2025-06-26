//  pages/api/stripe/webhook.js

import Stripe from 'stripe';
import { buffer } from 'micro';
import { supabase } from '../../../utils/database';

export const config = { api: { bodyParser: false } };

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end('Method Not Allowed');

  const sig = req.headers['stripe-signature'];
  const buf = await buffer(req);

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      buf,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('WEBHOOK SIGNATURE ERROR', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    console.log('📦 RAW EVENT:', event);

    const session = event.data.object;
    console.log('🧾 WEBHOOK SESSION:', session);

    const user_id = session.metadata?.user_id;


    if (user_id && quantity > 0) {
      const { data, error } = await supabase
        .from('users')
        .select('tokens')
        .eq('id', user_id)
        .single();

      if (fetchError || !userData) {
        console.error('USER FETCH ERROR:', fetchError || 'User not found');
        return res.status(500).json({ error: 'User fetch failed' });
      }

      const newTokenCount = (userData.tokens || 0) + tokenCount;

      const { error: updateError } = await supabase
        .from('users')
        .update({ tokens: newTokenCount })
        .eq('user_id', user_id);

      if (updateError) {
        console.error('TOKEN UPDATE ERROR:', updateError);
        return res.status(500).json({ error: 'Token update failed' });
      }

      console.log(`✅ Added ${tokenCount} tokens to user ${user_id}`);
    } else {
      console.warn('MISSING METADATA', { user_id, tokenCount });
    }
  }

  res.json({ received: true });
}
