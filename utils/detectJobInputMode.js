// Pure function — no JSX or React deps, so it can be imported in server/test contexts.
export function detectJobInputMode(value) {
  const trimmed = (value || '').trim();
  if (!trimmed) return 'text';
  // URL: single token (no internal whitespace) matching http(s)://...
  if (!/\s/.test(trimmed) && /^https?:\/\/\S+$/i.test(trimmed)) return 'url';
  return 'text';
}
