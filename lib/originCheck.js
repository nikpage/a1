// lib/originCheck.js

const allowedOrigins = [
  'https://thecv.pro',
  'http://localhost:3000'
];

export default function originCheck(req, res) {
  const origin = req.headers.origin;
  const referer = req.headers.referer;

  // Allow only if Origin or Referer matches allowed origins
  const valid =
    (origin && allowedOrigins.some((o) => origin.startsWith(o))) ||
    (referer && allowedOrigins.some((o) => referer.startsWith(o)));

  if (!valid) {
    res.status(403).json({ error: 'Invalid origin' });
    return false;
  }
  return true;
}
