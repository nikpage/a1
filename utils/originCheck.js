// utils/originCheck.js

export function getBaseUrl() {
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  if (process.env.VERCEL) return "https://thecv.pro";
  return "http://localhost:3000";
}

export function isValidOrigin(origin) {
  if (!origin) return false;

  const trustedOrigins = [
    "https://thecv.pro",
    "http://localhost:3000",
  ];

  // Add Vercel preview URLs
  if (process.env.VERCEL_URL) {
    trustedOrigins.push(`https://${process.env.VERCEL_URL}`);
  }

  return trustedOrigins.includes(origin);
}
