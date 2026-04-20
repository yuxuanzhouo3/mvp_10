/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  env: {
    NEXT_PUBLIC_CN: process.env.CN ?? '1',
  },
  images: {
    domains: ['localhost'],
  },
}

module.exports = nextConfig 
