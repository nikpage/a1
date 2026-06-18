/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true,
  },
  reactStrictMode: true,
  serverExternalPackages: ['uncrypto', '@upstash/redis'],
}

module.exports = nextConfig
