//  pages/api/stripe/webhook.js

import { logger } from '../../../lib/logger';
import Stripe from 'stripe';
import { buffer } from 'micro';
import { Redis } from '@upstash/redis';
import { addTokens, markCardVerified } from '../../../utils/database';
import { LIMITS } from '../../../config/limits';

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
    logger.error('WEBHOOK SIGNATURE ERROR', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const user_id = session.metadata?.user_id;

    // Card-verification (SetupIntent, no charge): mark card on file and grant free downloads.
    if (session.mode === 'setup') {
      if (user_id) {
        const key = `stripe_evt:${event.id}`;
        const first = await redis.set(key, '1', { nx: true, ex: 60 * 60 * 24 * 7 });
        if (first !== 'OK') return res.json({ received: true, duplicate: true });

        try {
          const granted = await markCardVerified(
            user_id,
            session.customer || null,
            LIMITS.FREE_DOWNLOADS
          );
          logger.info(`stripe ${event.id}: card verified for ${user_id}${granted ? `, granted ${LIMITS.FREE_DOWNLOADS} free download(s)` : ' (already on file)'}`);
        } catch (err) {
          await redis.del(key);
          logger.error('CARD VERIFY ERROR', err.message);
          return res.status(500).json({ error: 'Card verify failed' });
        }
      } else {
        logger.warn('WEBHOOK MISSING METADATA', { event_id: event.id });
      }
      return res.json({ received: true });
    }

    // Token purchase (payment mode).
    const quantity = parseInt(session.metadata?.quantity || '0', 10);
    if (user_id && quantity > 0) {
      const key = `stripe_evt:${event.id}`;
      const first = await redis.set(key, '1', { nx: true, ex: 60 * 60 * 24 * 7 });
      if (first !== 'OK') return res.json({ received: true, duplicate: true });

      try {
        await addTokens(user_id, quantity);
        logger.info(`stripe ${event.id}: credited ${quantity} tokens`);
      } catch (err) {
        await redis.del(key);
        logger.error('TOKEN CREDIT ERROR', err.message);
        return res.status(500).json({ error: 'Token credit failed' });
      }
    } else {
      logger.warn('WEBHOOK MISSING METADATA', { event_id: event.id });
    }
  }

  res.json({ received: true });
}
