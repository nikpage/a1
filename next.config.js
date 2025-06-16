/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    appDir: true
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals.push({
        'ws': 'commonjs ws',
        'websocket': 'commonjs websocket'
      })
    }
    return config
  }
}

module.exports = nextConfig
