/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  reactStrictMode: true, // Recommended for highlighting potential problems
  experimental: {
    // ✅ valid on Next 14.x
    serverComponentsExternalPackages: [
      'pdfjs-dist',
      'sharp',
      'tesseract.js',
      '@react-pdf/renderer',
    ],
  },
  webpack: (config, { dev }) => {
    if (dev) config.devtool = 'source-map'; // avoid eval-* (prevents pdf.js crash)
    return config;
  },
  experimental: { esmExternals: 'loose' }, // helps when any ESM sneaks in
};

export default nextConfig;
