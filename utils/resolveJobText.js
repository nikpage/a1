// Shared helper: if jobText looks like a URL, fetch its text via /api/fetch-job-url.
// On failure, throws with the server's error message so callers can surface it.
import { detectJobInputMode } from './detectJobInputMode.js';

export async function resolveJobText(jobText) {
  if (!jobText || detectJobInputMode(jobText) !== 'url') return jobText;

  const res = await fetch('/api/fetch-job-url', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: jobText }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Failed to fetch job URL');
  }
  if (typeof data.text !== 'string') {
    throw new Error('Failed to fetch job URL: unexpected server response');
  }
  return data.text;
}
