// lib/originCheck.js

export default function originCheck(req, res) {
  const origin = req.headers.origin || req.headers.referer;

  if (!origin) {
    res.status(403).json({ error: 'Origin required' });
    return false;
  }

  const productionUrl = process.env.PRODUCTION_URL;

  // Strict origin checking - EXACT matches only
  const isAllowed =
    (process.env.NODE_ENV === 'development' && origin === 'http://localhost:3000') ||
    (productionUrl && origin === productionUrl) ||
    origin.endsWith('.vercel.app');

  if (!isAllowed) {
    // Log suspicious requests
    console.warn(`Blocked origin: ${origin} from IP: ${req.headers['x-forwarded-for'] || req.socket?.remoteAddress}`);
    res.status(403).json({ error: 'Origin forbidden' });
    return false;
  }

  // Set security headers
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');

  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }

  return true;
}
