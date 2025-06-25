// pages/api/stripe/create-session.js

import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { quantity, user_id } = req.body;

  const prices = {
    1: 600,    // €6.00
    2: 800,    // €8.00
    10: 2300,  // €23.00
    30: 4200   // €42.00
  };

  const amount = prices[quantity];
  if (!amount) {
    return res.status(400).json({ error: 'Invalid quantity' });
  }

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: { name: `${quantity} Token${quantity > 1 ? 's' : ''}` },
            unit_amount: amount,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${req.headers.origin}/payment-success?user_id=${user_id}&quantity=${quantity}`,
      cancel_url: `${req.headers.origin}/cancel`,
    });

    res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('Stripe session error:', err);
    res.status(500).json({ error: 'Stripe session creation failed' });
  }
}
