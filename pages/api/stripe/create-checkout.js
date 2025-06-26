// pages/api/stripe/create-checkout.js

import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const PRICE_MAP = {
  1: { amount: 600, name: '1 Token' },
  2: { amount: 800, name: '2 Tokens' },
  10: { amount: 2300, name: '10 Tokens' },
  30: { amount: 4200, name: '30 Tokens' },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { quantity, user_id } = req.body;

  if (!PRICE_MAP[quantity] || !user_id) {
    return res.status(400).json({ error: 'Invalid request' });
  }

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: { name: PRICE_MAP[quantity].name },
            unit_amount: PRICE_MAP[quantity].amount,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/payment-success?user_id=${user_id}&quantity=${quantity}`,
      cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/`,
      metadata: { user_id, quantity }
    });

    res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('Stripe session error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}
