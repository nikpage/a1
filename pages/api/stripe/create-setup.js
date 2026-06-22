// pages/api/stripe/create-setup.js
//
// Starts a Stripe Checkout session in `setup` mode: captures and verifies the
// user's card WITHOUT charging. On success the webhook marks card_on_file and
// grants the free download(s). user_id comes from the verified session.

import Stripe from 'stripe';
import { logger } from '../../../lib/logger';
import { getUser } from '../../../utils/database';
import requireAuth from '../../../lib/requireAuth';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { user_id } = req.user;

  let user;
  try { user = await getUser(user_id); } catch { return res.status(404).json({ error: 'User not found' }); }

  if (user.card_on_file) {
    return res.status(409).json({ error: 'CARD_ALREADY_ON_FILE' });
  }

  try {
    // Reuse an existing customer if we have one, else let Checkout create it.
    let customer = user.stripe_customer_id;
    if (!customer) {
      const created = await stripe.customers.create({
        email: user.email || undefined,
        metadata: { user_id },
      });
      customer = created.id;
    }

    const origin = req.headers.origin || process.env.NEXT_PUBLIC_SITE_URL || 'https://www.thecv.pro';
    const session = await stripe.checkout.sessions.create({
      mode: 'setup',
      payment_method_types: ['card'],
      customer,
      success_url: `${origin}/account?card=verified`,
      cancel_url: `${origin}/account?card=cancelled`,
      metadata: { user_id, intent: 'card_verify' },
    });

    res.status(200).json({ url: session.url });
  } catch (err) {
    logger.error('Stripe setup session error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export default requireAuth(handler);
