/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Explicitly disable App Router
  experimental: {
    appDir: false
  }
  // Add other Next.js config options here as needed
}

module.exports = nextConfig
