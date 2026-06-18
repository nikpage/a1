/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    appDir: false,
  },
  env: {
    NEXT_PUBLIC_BASE_URL: process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000',
  },
  turbopack: {},
  serverExternalPackages: ['uncrypto', '@upstash/redis'],

  i18n: {
    locales: ['en', 'cs'],   // ✅ correct ISO code
    defaultLocale: 'en',
  },
}

module.exports = nextConfig
