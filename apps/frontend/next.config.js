/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@n8n-streamdeck/shared', '@n8n-streamdeck/config'],
};

module.exports = nextConfig;