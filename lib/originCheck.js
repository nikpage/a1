// lib/originCheck.js

export default function originCheck(req, res) {
  const origin = req.headers.origin || req.headers.referer;

  // If no origin or referer is present at all, block the request.
  if (!origin) {
    res.status(403).json({ error: 'Invalid origin' });
    return false;
  }

  // Get the main production URL from environment variables.
  const productionUrl = process.env.PRODUCTION_URL;

  // Check if the origin matches one of the dynamic rules.
  const isAllowed =
    // Rule 1: Allow localhost for local development.
    origin.startsWith('http://localhost:3000') ||
    // Rule 2: Allow the main production domain if it's set.
    (productionUrl && origin.startsWith(productionUrl)) ||
    // Rule 3: Allow any Vercel preview deployment URL.
    origin.endsWith('.vercel.app');

  if (!isAllowed) {
    res.status(403).json({ error: 'Invalid origin' });
    return false;
  }

  return true;
}
