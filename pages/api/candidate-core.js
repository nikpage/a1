// pages/api/candidate-core.js
//
// Read or update the signed-in user's candidate-core profile (the job-agnostic
// "who I am"). GET returns it; PUT saves the user's own edit. user_id always
// comes from the verified session, never the body.

import { getCandidateCore, updateCandidateCore } from '../../utils/database';
import requireAuth from '../../lib/requireAuth';

const MAX_LEN = 1500;

async function handler(req, res) {
  const { user_id } = req.user;

  if (req.method === 'GET') {
    try {
      const core = await getCandidateCore(user_id);
      return res.status(200).json({ candidate_core: core });
    } catch {
      return res.status(404).json({ error: 'User not found' });
    }
  }

  if (req.method === 'PUT') {
    const { candidate_core } = req.body || {};
    if (typeof candidate_core !== 'string') {
      return res.status(400).json({ error: 'candidate_core must be a string' });
    }
    const trimmed = candidate_core.trim().slice(0, MAX_LEN);
    try {
      await updateCandidateCore(user_id, trimmed);
      return res.status(200).json({ candidate_core: trimmed });
    } catch {
      return res.status(500).json({ error: 'Could not save' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

export default requireAuth(handler);
