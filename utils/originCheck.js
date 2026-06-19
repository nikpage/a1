const ALLOWED_ORIGINS = [
  'https://cv-pro.netlify.app',
];

export function isValidOrigin(origin) {
  if (process.env.NODE_ENV !== 'production') {
    return true;
  }
  return origin && ALLOWED_ORIGINS.includes(origin);
}

export function getBaseUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
}
