// /api/create-checkout-session.js

import Stripe from 'stripe';
import { getUID } from '../../utils/auth.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const DOMAIN = process.env.SITE_URL || 'http://localhost:3000'; // your frontend domain

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end('Method Not Allowed');

  const uid = getUID(req);
  if (!uid) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'Token Pack',
            },
            unit_amount: 500, // $5.00 for example
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${DOMAIN}/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${DOMAIN}/index.html`,
      metadata: {
        uid,
      },
    });

    res.status(200).json({ url: session.url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Stripe session creation failed' });
  }
}
