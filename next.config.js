/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_BASE_URL: process.env.URL || 'http://localhost:3000',
  },
  i18n: {
    locales: ['en', 'cs'],
    defaultLocale: 'en',
  },
}

module.exports = nextConfig
