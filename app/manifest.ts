import type { MetadataRoute } from 'next';
import { vestBlockDefaultDescription, vestBlockSiteName } from '@/lib/seo/site';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${vestBlockSiteName} — Find Your Next Move`,
    short_name: vestBlockSiteName,
    description: vestBlockDefaultDescription,
    start_url: '/',
    display: 'standalone',
    background_color: '#06090c',
    theme_color: '#d7f80b',
    icons: [
      {
        src: '/icon.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/apple-icon.png',
        sizes: '180x180',
        type: 'image/png',
        purpose: 'any',
      },
    ],
  };
}
