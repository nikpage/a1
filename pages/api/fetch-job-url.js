import { logger } from '../../lib/logger';

const MAX_BODY_CHARS = 2 * 1024 * 1024; // ~2 MB

// Matches loopback, private-range, and link-local hosts (IPv4 and common IPv6).
// NOTE: new URL().hostname wraps IPv6 addresses in brackets (e.g. "[::1]"); isPrivateHost
// strips those brackets before testing so bare IPv6 patterns match correctly.
const PRIVATE_HOST_RE = /^(localhost|127\.\d+\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2[0-9]|3[01])\.\d+\.\d+|192\.168\.\d+\.\d+|169\.254\.\d+\.\d+|0\.\d+\.\d+\.\d+|::1|fd[0-9a-f]{2}:|fc[0-9a-f]{2}:|fe[89ab][0-9a-f]:)$/i;

function isPrivateHost(hostname) {
  const h = hostname.startsWith('[') && hostname.endsWith(']')
    ? hostname.slice(1, -1)
    : hostname;
  return PRIVATE_HOST_RE.test(h);
}

function stripHtml(html) {
  let text = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<header[\s\S]*?<\/header>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '');

  text = text.replace(/<[^>]+>/g, ' ');

  text = text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));

  return text.replace(/\s+/g, ' ').trim();
}

async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { url } = req.body || {};
  if (!url) {
    return res.status(400).json({ error: 'Missing url' });
  }

  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return res.status(400).json({ error: 'Invalid URL' });
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return res.status(400).json({ error: 'Only http and https URLs are allowed' });
  }

  if (isPrivateHost(parsed.hostname)) {
    return res.status(400).json({ error: 'Private or local URLs are not allowed' });
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  let response;
  try {
    response = await fetch(parsed.href, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      logger.error('[fetch-job-url] timeout fetching:', url);
      return res.status(504).json({ error: 'Request timed out. Try pasting the job ad text instead.' });
    }
    logger.error('[fetch-job-url] fetch error:', err.message);
    return res.status(502).json({ error: 'Could not reach the URL. Try pasting the job ad text instead.' });
  }
  clearTimeout(timeoutId);

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) {
    return res.status(400).json({ error: 'URL did not return an HTML page. Try pasting the job ad text instead.' });
  }

  let raw;
  try {
    raw = await response.text();
  } catch (err) {
    logger.error('[fetch-job-url] body read error:', err.message);
    return res.status(502).json({ error: 'Failed to read the page. Try pasting the job ad text instead.' });
  }

  const html = raw.length > MAX_BODY_CHARS ? raw.slice(0, MAX_BODY_CHARS) : raw;
  const text = stripHtml(html);

  if (text.length < 500) {
    return res.status(422).json({
      error: 'This page appears to block automated access or loads its content via JavaScript. Please paste the job ad text directly instead.',
    });
  }

  logger.info(`[fetch-job-url] fetched ${url} (${text.length} chars)`);
  return res.status(200).json({ text });
}

export default handler;
