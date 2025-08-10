const ALLOWED_PRODUCTION_ORIGINS = [
  'https://thecv.pro',
  'https://www.thecv.pro',
];

export function isValidOrigin(origin) {
  if (process.env.NEXT_PUBLIC_VERCEL_ENV !== 'production') {
    return true;
  }
  return origin && ALLOWED_PRODUCTION_ORIGINS.includes(origin);
}

export function getBaseUrl() {
  if (process.env.NEXT_PUBLIC_VERCEL_ENV === 'production') {
    return 'https://www.thecv.pro';
  }
  if (process.env.NEXT_PUBLIC_VERCEL_URL) {
    return `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`;
  }
  return 'http://localhost:3000';
}
