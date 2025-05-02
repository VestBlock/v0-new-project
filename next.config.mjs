/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    domains: ['localhost', 'vestblock.io', 'vestblock-assets.vercel.app'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
    unoptimized: true,
  },
  experimental: {
    // Explicitly set React version to 18.2.0
    react: {
      version: '18.2.0',
    },
    // Optimize serverless functions
    serverComponentsExternalPackages: [
      'sharp',
      'pdf-parse',
      'p-retry',
    ],
    // Improve memory usage
    optimizePackageImports: [
      'lucide-react',
      'date-fns',
      'react-day-picker',
    ],
  },
  // Configure headers for security
  headers: async () => {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
        ],
      },
    ];
  },
  // Configure redirects
  redirects: async () => {
    return [
      {
        source: '/home',
        destination: '/',
        permanent: true,
      },
    ];
  },
  // Configure webpack for compatibility
  webpack: (config, { isServer }) => {
    // Fix for react-day-picker compatibility
    config.resolve.alias = {
      ...config.resolve.alias,
      'react/jsx-runtime': require.resolve('react/jsx-runtime'),
    };
    
    // Add resolution for React 18.2.0
    config.resolve.alias = {
      ...config.resolve.alias,
      'react': require.resolve('react'),
      'react-dom': require.resolve('react-dom'),
    };
    
    return config;
  },
};

export default nextConfig;
