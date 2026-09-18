import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'VestBlock',
    short_name: 'VestBlock',
    description:
      'Funding preparation, real-estate paths, and practical business growth in one coordinated place.',
    start_url: '/',
    display: 'standalone',
    background_color: '#0B0D0C',
    theme_color: '#0B0D0C',
    icons: [
      {
        src: '/brand/vestblock-icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/brand/vestblock-icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/brand/vestblock-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
