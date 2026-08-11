// pages/api/get-generation-status.js
//
// Poll endpoint for the background generation flow. user_id comes from the
// verified session cookie (requireAuth); generation_id — an unguessable UUID
// minted per run by the client — scopes the lookup to that run.

import { logger } from '../../lib/logger';
import requireAuth from '../../lib/requireAuth';
import { readGenerationStatus } from '../../utils/generation-status';

async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { generation_id } = req.body || {};
  if (!generation_id) return res.status(400).json({ error: 'Missing generation_id' });

  let payload;
  try {
    payload = await readGenerationStatus(req.user.user_id, generation_id);
  } catch (error) {
    logger.error('[get-generation-status] read error:', error.message);
    return res.status(500).json({ error: 'Error fetching generation status' });
  }

  if (!payload) return res.status(200).json({ status: 'pending' });
  return res.status(200).json(payload);
}

export default requireAuth(handler);
