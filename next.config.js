/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // This line is the critical fix.
    appDir: false
  },
  env: {
    NEXT_PUBLIC_BASE_URL: process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000'
  }
}

module.exports = nextConfig
