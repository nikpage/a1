// pages/api/profile-status.js
//
// Tells the client whether the authenticated user already has a built MASTER CV.
// The CV uploader uses this to decide whether a fresh upload should offer the
// "add to my existing profile vs start fresh" choice. Identity comes from the
// verified session (req.user) — never the body.

import requireAuth from '../../lib/requireAuth';
import { getMasterCv } from '../../utils/database';

async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    const master = await getMasterCv(req.user.user_id);
    return res.status(200).json({ hasMaster: !!master });
  } catch (e) {
    // A read failure must not block uploading — degrade to "no profile".
    return res.status(200).json({ hasMaster: false });
  }
}

export default requireAuth(handler);
