import { ImageResponse } from 'next/og';

import { VestBlockSocialCard } from '@/components/seo/vestblock-social-card';

export const runtime = 'edge';
export const alt =
  'VestBlock — find your next move across funding, real estate, and business growth';
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = 'image/png';

export default function TwitterImage() {
  return new ImageResponse(<VestBlockSocialCard />, size);
}
