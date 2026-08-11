// utils/generateDocuments.js
//
// Single shared generation flow for every caller (viewer, regenerate, workbench,
// DocumentGenerator): kick the background function directly with a relative URL,
// then poll until the run publishes a terminal status.
//
// Generation is a BACKGROUND function for the same reason analysis is — a run is
// up to six Gemini calls and blows straight through Netlify's 10s synchronous
// limit, which surfaced as a 502 HTML page. See utils/uploadAndAnalyze.js for
// the identical kick-and-poll shape on the analysis side.

const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 600000; // 10 min — under the 15-min background budget

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Resolves to { ok: true, cv?, cover?, cv_warnings?, gemini_usage } on success,
// or { ok: false, error, detail? } — `error` carrying the same codes the old
// synchronous route returned (NO_GENERATIONS_LEFT, 'Generation failed', …).
export async function generateDocuments({ analysis, tone, type, tweak = '', language = 'auto' }) {
  const generation_id = (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.round(Math.random() * 1e9)}`;

  const kickRes = await fetch('/.netlify/functions/generate-background', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ generation_id, analysis, tone, type, tweak, language }),
  });
  if (kickRes.status !== 202 && !kickRes.ok) {
    return { ok: false, error: `Could not start generation (${kickRes.status})` };
  }

  const deadline = Date.now() + POLL_TIMEOUT_MS;
  // A poll that keeps failing is a broken poll, not a slow generation. Tolerate a
  // blip, then surface the reason — spinning silently through 200 x HTTP 500 and
  // calling it "timed out" hides the actual fault.
  let consecutiveFailures = 0;
  while (Date.now() < deadline) {
    await sleep(POLL_INTERVAL_MS);

    const statusRes = await fetch('/api/get-generation-status', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ generation_id }),
    });
    if (!statusRes.ok) {
      if (++consecutiveFailures >= 3) {
        const body = await statusRes.json().catch(() => ({}));
        return {
          ok: false,
          error: body.error || `Could not read generation status (${statusRes.status})`,
          detail: body.detail,
        };
      }
      continue; // transient — keep polling
    }
    consecutiveFailures = 0;

    const payload = await statusRes.json().catch(() => ({}));
    if (payload.status === 'done') {
      const { status, ...rest } = payload;
      return { ok: true, ...rest };
    }
    if (payload.status === 'error') {
      return { ok: false, error: payload.error || 'Generation failed', detail: payload.detail };
    }
    // 'pending' — keep polling
  }

  return { ok: false, error: 'Generation timed out. Please try again.' };
}
