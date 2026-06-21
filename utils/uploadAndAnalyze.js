// path: utils/uploadAndAnalyze.js
//
// Single shared analysis flow for BOTH the landing page and the logged-in
// CV+job-ad flow: (optionally) upload the CV, kick the background analysis
// function directly, then poll until the result is saved. Calling the background
// function with a relative URL avoids any server-to-server hop / base-URL env.

import { logger } from '../lib/logger.js';

const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 600000; // 10 min — under the 15-min background budget

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function logGemini(u) {
  if (!u) return;
  if (Array.isArray(u)) { u.forEach(logGemini); return; }
  logger.info(`[Gemini] ${u.label} | model: ${u.model} | in: ${u.inputTokens.toLocaleString()} out: ${u.outputTokens.toLocaleString()} think: ${(u.thinkingTokens||0).toLocaleString()} total: ${u.totalTokens.toLocaleString()} | cost: $${u.costUsd.toFixed(6)}`);
}

export async function uploadAndAnalyze({
  file,
  jobText,
  user_id,
  created_at,
  file_name,
  fallbackCvText,     // kept for call-site compatibility (unused)
  fallbackCreatedAt,  // kept for call-site compatibility
  onPing,
}) {
  let finalUserId = user_id ?? (typeof window !== 'undefined' ? window.localStorage.getItem('user_id') : null);
  const finalCreatedAt = created_at ?? fallbackCreatedAt ?? null;
  const finalFileName = file_name || (file && file.name) || 'Unnamed file';

  // 1. Upload the file if one was provided
  if (file) {
    const formData = new FormData();
    formData.append('file', file);
    if (finalUserId) formData.append('user_id', finalUserId);

    const uploadRes = await fetch('/api/upload-cv', { method: 'POST', body: formData });
    const uploadData = await uploadRes.json();
    if (!uploadRes.ok || !uploadData.user_id) {
      throw new Error(uploadData.error || 'Upload failed');
    }
    finalUserId = uploadData.user_id;
  }

  if (!finalUserId) throw new Error('Missing user_id for analysis');

  // 2. Kick off the background analysis (relative URL → no base-URL dependency).
  //    Background functions answer 202 and keep running.
  const analysis_id = (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : `${finalUserId}-${Date.now()}-${Math.round(Math.random() * 1e9)}`;

  const kickRes = await fetch('/.netlify/functions/analyse-background', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user_id: finalUserId,
      jobText,
      created_at: finalCreatedAt,
      file_name: finalFileName,
      analysis_id,
    }),
  });
  if (kickRes.status !== 202 && !kickRes.ok) {
    throw new Error(`Could not start analysis (${kickRes.status})`);
  }

  // 3. Poll until the analysis is saved (or an error sentinel / timeout)
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (typeof onPing === 'function') onPing({ status: 'thinking' });
    await sleep(POLL_INTERVAL_MS);

    const statusRes = await fetch('/api/get-analysis-status', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: finalUserId, analysis_id }),
    });
    if (!statusRes.ok) continue; // transient — keep polling

    const payload = await statusRes.json().catch(() => ({}));
    if (payload.status === 'done') {
      logGemini(payload.gemini_usage);
      return { user_id: finalUserId, analysis_id, analysis: payload.analysis, gemini_usage: payload.gemini_usage };
    }
    if (payload.status === 'error') {
      throw new Error(payload.error || 'Analysis failed');
    }
    // 'pending' — keep polling
  }

  throw new Error('Analysis timed out. Please try again.');
}
