// pages/api/stripe/webhook.js

import Stripe from 'stripe';
import { buffer } from 'micro';
import { supabase } from '../../../utils/database';

export const config = {
  api: {
    bodyParser: false,
  },
};

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end('Method Not Allowed');

  const sig = req.headers['stripe-signature'];
  const buf = await buffer(req);
  let event;

  try {
    event = stripe.webhooks.constructEvent(buf, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const user_id = session.metadata.user_id;
    const quantity = parseInt(session.metadata.quantity);

    if (user_id && quantity) {
      await supabase.rpc('add_tokens', { p_user_id: user_id, p_amount: quantity });
    }
  }

  res.json({ received: true });
}
