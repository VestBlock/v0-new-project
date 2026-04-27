import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
  reactStrictMode: true,
  outputFileTracingRoot: __dirname,
  serverExternalPackages: [
    'pdfjs-dist',
    'sharp',
    'tesseract.js',
    '@react-pdf/renderer',
  ],
  webpack: (config, { dev }) => {
    if (dev) config.devtool = 'source-map';
    return config;
  },
};

export default nextConfig;
