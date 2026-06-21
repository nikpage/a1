//  pages/api/stripe/webhook.js

import Stripe from 'stripe';
import { buffer } from 'micro';
import { Redis } from '@upstash/redis';
import { addTokens } from '../../../utils/database';

export const config = { api: { bodyParser: false } };

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const redis = Redis.fromEnv();

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end('Method Not Allowed');

  const sig = req.headers['stripe-signature'];
  const buf = await buffer(req);

  let event;
  try {
    event = stripe.webhooks.constructEvent(buf, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('WEBHOOK SIGNATURE ERROR', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const user_id = session.metadata?.user_id;
    const quantity = parseInt(session.metadata?.quantity || '0', 10);

    if (user_id && quantity > 0) {
      const key = `stripe_evt:${event.id}`;
      const first = await redis.set(key, '1', { nx: true, ex: 60 * 60 * 24 * 7 });
      if (first !== 'OK') return res.json({ received: true, duplicate: true });

      try {
        await addTokens(user_id, quantity);
        console.log(`stripe ${event.id}: credited ${quantity} tokens to ${user_id}`);
      } catch (err) {
        await redis.del(key);
        console.error('TOKEN CREDIT ERROR', err.message);
        return res.status(500).json({ error: 'Token credit failed' });
      }
    } else {
      console.warn('WEBHOOK MISSING METADATA', { event_id: event.id });
    }
  }

  res.json({ received: true });
}
