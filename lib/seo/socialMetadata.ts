import type { Metadata } from 'next';

import { absoluteUrl, vestBlockSiteName } from '@/lib/seo/site';

export const vestBlockSocialImageAlt =
  'VestBlock — find your next move across funding, real estate, and business growth';

export const vestBlockOpenGraphDefaults = {
  type: 'website',
  siteName: vestBlockSiteName,
  images: [
    {
      url: absoluteUrl('/opengraph-image?v=3'),
      width: 1200,
      height: 630,
      alt: vestBlockSocialImageAlt,
    },
  ],
} satisfies NonNullable<Metadata['openGraph']>;

export const vestBlockTwitterDefaults = {
  card: 'summary_large_image',
  images: [
    {
      url: absoluteUrl('/twitter-image?v=3'),
      width: 1200,
      height: 630,
      alt: vestBlockSocialImageAlt,
    },
  ],
} satisfies NonNullable<Metadata['twitter']>;
