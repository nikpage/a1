// pages/api/stripe/webhook.js

import Stripe from 'stripe';
const buffer = async (readable) => {
  const chunks = [];
  for await (const chunk of readable) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
};

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
    console.log('EVENT', event);

    const session = event.data.object;
    const user_id = session.metadata?.user_id;
    const quantity = parseInt(session.metadata?.quantity || '0', 10);

    if (user_id && quantity > 0) {
      const { data, error } = await supabase
        .from('users')
        .update({ tokens: supabase.raw('tokens + ?', [quantity]) })
        .eq('user_id', user_id)
        .select('tokens');

      if (error) {
        console.error('SUPABASE UPDATE ERROR', error);
      } else {
        console.log('TOKENS ADDED', data);
      }
    } else {
      console.warn('MISSING METADATA', { user_id, quantity });
    }
  }

  res.json({ received: true });
}
