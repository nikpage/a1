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
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals.push({
        ws: 'commonjs ws',
        websocket: 'commonjs websocket',
      })
    }
    return config
  },

  i18n: {
    locales: ['en', 'cs'],   // ✅ correct ISO code
    defaultLocale: 'en',
  },
}

module.exports = nextConfig
