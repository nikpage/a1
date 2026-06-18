/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true,
  },
  reactStrictMode: true,
  serverExternalPackages: ['uncrypto', '@upstash/redis', 'pdf-parse', 'mammoth'],
}

module.exports = nextConfig
