/** @type {import('next').NextConfig} */
const nextConfig = {
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
