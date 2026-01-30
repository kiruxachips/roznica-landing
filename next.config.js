/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'millor-shop.ru',
      },
    ],
  },
}

module.exports = nextConfig
