/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@n8n-streamdeck/shared', '@n8n-streamdeck/config'],

  // Enable standalone output for Docker
  output: 'standalone',
  // Disable static generation completely to avoid SSR issues
  trailingSlash: true,
  skipTrailingSlashRedirect: true,
  // Performance optimizations
  experimental: {
    // Disable CSS optimization for development builds to avoid critters dependency issue
    optimizeCss: process.env.NODE_ENV === 'production',
    optimizePackageImports: ['@tanstack/react-query', 'socket.io-client'],
    // Force dynamic rendering
    forceSwcTransforms: true,
  },

  // Skip build errors for problematic pages
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },

  // Disable static generation completely
  distDir: '.next',
  poweredByHeader: false,

  // Disable static optimization completely
  generateBuildId: async () => {
    return 'build-' + Date.now();
  },

  // Bundle optimization
  webpack: (config, { dev }) => {
    // Production optimizations
    if (!dev) {
      // Enable tree shaking
      config.optimization.usedExports = true;
      config.optimization.sideEffects = false;

      // Split chunks for better caching
      config.optimization.splitChunks = {
        chunks: 'all',
        cacheGroups: {
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            chunks: 'all',
            priority: 10,
          },
          common: {
            name: 'common',
            minChunks: 2,
            chunks: 'all',
            priority: 5,
            reuseExistingChunk: true,
          },
          react: {
            test: /[\\/]node_modules[\\/](react|react-dom)[\\/]/,
            name: 'react',
            chunks: 'all',
            priority: 20,
          },
          query: {
            test: /[\\/]node_modules[\\/]@tanstack[\\/]react-query[\\/]/,
            name: 'react-query',
            chunks: 'all',
            priority: 15,
          },
          socket: {
            test: /[\\/]node_modules[\\/]socket\.io-client[\\/]/,
            name: 'socket-io',
            chunks: 'all',
            priority: 15,
          },
        },
      };
    }

    // Bundle analyzer (only in development)
    if (dev && process.env.ANALYZE === 'true') {
      const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');
      config.plugins.push(
        new BundleAnalyzerPlugin({
          analyzerMode: 'server',
          openAnalyzer: true,
        })
      );
    }

    return config;
  },

  // Image optimization
  images: {
    formats: ['image/webp', 'image/avif'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60 * 60 * 24 * 30, // 30 days
  },

  // Compression
  compress: true,

  // Headers for caching
  async headers() {
    return [
      {
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/images/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=86400',
          },
        ],
      },
    ];
  },

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
