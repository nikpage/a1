const LOCALHOST = 'http://localhost:3000';

export function isValidOrigin(origin) {
  if (!origin) return false;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (siteUrl && origin === siteUrl) return true;
  if (process.env.NODE_ENV !== 'production' && origin === LOCALHOST) return true;
  return false;
}

export function getBaseUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL || LOCALHOST;
}
