/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@n8n-streamdeck/shared', '@n8n-streamdeck/config'],
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
