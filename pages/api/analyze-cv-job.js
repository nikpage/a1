// pages/api/analyze-cv-job.js
//
// Thin kick-off route for analysis. It no longer runs Gemini inline (that blew
// past Netlify's 10s function limit). Instead it triggers the background
// function analyze-cv-job-background and returns an analysis_id immediately; the
// client polls /api/get-analysis-status for the result.
//
// Kept at this path on purpose: middleware.js applies the Upstash rate limit and
// payload-size guard to /api/analyze-cv-job.

import crypto from 'crypto';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { user_id, jobText, created_at } = req.body || {};
  const file_name = req.body?.file_name || 'Unnamed file';

  if (!user_id) {
    return res.status(400).json({ error: 'Missing user_id in request body' });
  }

  const analysis_id = crypto.randomUUID();

  const baseURL = process.env.NODE_ENV === 'development'
    ? 'http://localhost:3000'
    : process.env.NEXT_PUBLIC_SITE_URL;

  try {
    const bgRes = await fetch(`${baseURL}/.netlify/functions/analyze-cv-job-background`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id, jobText, created_at, file_name, analysis_id }),
    });

    // Background functions answer 202; treat anything else as a failed dispatch.
    if (bgRes.status !== 202 && !bgRes.ok) {
      console.error('[analyze-cv-job] background dispatch failed:', bgRes.status);
      return res.status(502).json({ error: 'Could not start analysis' });
    }

    return res.status(202).json({ analysis_id });
  } catch (e) {
    console.error('[analyze-cv-job] failed to start background:', e.message);
    return res.status(502).json({ error: 'Could not start analysis' });
  }
}
