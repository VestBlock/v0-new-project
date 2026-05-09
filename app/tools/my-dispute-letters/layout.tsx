import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { requirePaidToolAccess } from '@/lib/auth/access-server';
import { absoluteUrl } from '@/lib/seo/site';

export const metadata: Metadata = {
  title: 'My Dispute Letters',
  description:
    'Review saved dispute letters, follow timing, open PDFs, and manage next-step credit repair work inside VestBlock.',
  alternates: {
    canonical: '/tools/my-dispute-letters',
  },
  openGraph: {
    title: 'VestBlock My Dispute Letters',
    description:
      'Saved dispute letters, status tracking, and follow-up timing for paid VestBlock credit workflows.',
    url: absoluteUrl('/tools/my-dispute-letters'),
  },
};

export default async function MyDisputeLettersLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requirePaidToolAccess('/tools/my-dispute-letters');
  return children;
}
