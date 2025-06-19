/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    appDir: false // ✅ Fix is here, inside the config
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
