const ALLOWED_ORIGINS = [
  'https://thecv.pro',
  'https://www.thecv.pro',
  'https://cv-pro.netlify.app',
];

export function isValidOrigin(origin) {
  if (process.env.NODE_ENV !== 'production') {
    return true;
  }
  return origin && ALLOWED_ORIGINS.includes(origin);
}

export function getBaseUrl() {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL;
  }
  return 'http://localhost:3000';
}
