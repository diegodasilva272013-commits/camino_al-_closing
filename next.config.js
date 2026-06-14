/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
    ],
  },
  webpack: (config, { dev, nextRuntime }) => {
    if (dev && nextRuntime === 'edge') {
      // Node 22 + Next.js edge runtime sandbox bloquea eval(); desactivamos source maps
      config.devtool = false;
    }
    return config;
  },
};

module.exports = nextConfig;
