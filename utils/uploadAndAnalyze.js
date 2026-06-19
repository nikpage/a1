// path: utils/uploadAndAnalyze.js
//
// Single shared client flow for analysis: (optionally) upload the CV, kick off
// the background analysis function, then poll until the result is saved. Used by
// the guest upload flow (pages/index.js), the CV uploader, and the Start-Fresh
// modal, so the kick/poll logic lives in exactly one place.

const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 180000; // 3 min — comfortably under the 15-min background budget

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

  // 2. Kick off the background analysis (rate-limited by middleware; returns fast)
  const kickRes = await fetch('/api/analyze-cv-job', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user_id: finalUserId,
      jobText,
      created_at: finalCreatedAt,
      file_name: finalFileName,
    }),
  });
  const kickData = await kickRes.json().catch(() => ({}));
  if (!kickRes.ok && kickRes.status !== 202) {
    throw new Error(kickData.error || `Analysis failed (${kickRes.status})`);
  }
  const analysis_id = kickData.analysis_id;
  if (!analysis_id) throw new Error('Analysis did not start');

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
      return { user_id: finalUserId, analysis_id, analysis: payload.analysis };
    }
    if (payload.status === 'error') {
      throw new Error(payload.error || 'Analysis failed');
    }
    // 'pending' — keep polling
  }

  throw new Error('Analysis timed out. Please try again.');
}
