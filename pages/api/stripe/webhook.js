//  pages/api/stripe/webhook.js

import Stripe from 'stripe';
import { supabase } from '../../../utils/database';

export const config = { api: { bodyParser: false } };

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const buffer = async (readable) => {
  const chunks = [];
  for await (const chunk of readable) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
};

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
    const session = event.data.object;
    const email = session.customer_details?.email;

    if (!email) {
      console.warn('MISSING EMAIL');
      return res.status(400).json({ error: 'Missing email' });
    }

    let productName = '';
    try {
      const lineItems = await stripe.checkout.sessions.listLineItems(session.id);
      productName = lineItems?.data?.[0]?.description?.toLowerCase() || '';
    } catch (e) {
      console.error('LINE ITEM FETCH FAIL:', e.message);
    }

    const tokenCount =
      productName.includes('1') ? 1 :
      productName.includes('2') ? 2 :
      productName.includes('10') ? 10 :
      productName.includes('30') ? 30 : 0;

    if (tokenCount === 0) {
      console.warn('UNRECOGNIZED PRODUCT:', productName);
      return res.status(400).json({ error: 'Unknown product' });
    }

    const { data: user, error } = await supabase
      .from('users')
      .update({ tokens: supabase.raw('tokens + ?', [tokenCount]) })
      .ilike('email', email)
      .select();

    if (error || !user.length) {
      console.error('SUPABASE UPDATE ERROR:', error || 'User not found');
      return res.status(500).json({ error: 'Token update failed' });
    }

    console.log(`✅ Added ${tokenCount} tokens to ${email}`);
  }

  res.json({ received: true });
}
