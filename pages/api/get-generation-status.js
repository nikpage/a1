// pages/api/get-generation-status.js
//
// Poll endpoint for the background generation flow. user_id comes from the
// verified session cookie (requireAuth); generation_id — an unguessable UUID
// minted per run by the client — scopes the lookup to that run.
//
// Status lives in the DATABASE, not Redis: a Redis read that throws here fails
// the whole poll, and Upstash is not reachable from the Next server runtime
// (the gen_lock has been failing open in it all along, silently).

import { logger } from '../../lib/logger';
import requireAuth from '../../lib/requireAuth';
import { getGenerationStatus } from '../../utils/database';

async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { generation_id } = req.body || {};
  if (!generation_id) return res.status(400).json({ error: 'Missing generation_id' });

  let payload;
  try {
    payload = await getGenerationStatus(req.user.user_id, generation_id);
  } catch (error) {
    // Name the underlying failure: a poll that 500s with a generic string is
    // indistinguishable from a hang, which is how this cost an afternoon once.
    logger.error('[get-generation-status] read error:', error.message);
    return res.status(500).json({ error: 'Error fetching generation status', detail: error.message });
  }

  if (!payload) return res.status(200).json({ status: 'pending' });
  return res.status(200).json(payload);
}

export default requireAuth(handler);
