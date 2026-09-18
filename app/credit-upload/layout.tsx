import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { absoluteUrl } from '@/lib/seo/site';
import { vestBlockOpenGraphDefaults, vestBlockTwitterDefaults } from '@/lib/seo/socialMetadata';

export const metadata: Metadata = {
  title: 'AI Credit Report Analysis And Dispute Letter Prep',
  description:
    'Upload a credit report to VestBlock, organize negative items, review AI-powered credit analysis, and prepare dispute-letter drafts for user review.',
  alternates: {
    canonical: '/credit-upload',
  },
  openGraph: {
    ...vestBlockOpenGraphDefaults,
    title: 'VestBlock AI Credit Report Analysis',
    description:
      'AI credit report upload, analysis, dispute-letter support, progress alerts, and review support for credit repair preparation.',
    url: absoluteUrl('/credit-upload'),
  },
  twitter: {
    ...vestBlockTwitterDefaults,
    title: 'VestBlock AI Credit Report Analysis',
    description:
      'AI credit report upload, analysis, dispute-letter support, progress alerts, and review support for credit repair preparation.',
  },
};

export default function CreditUploadLayout({ children }: { children: ReactNode }) {
  return children;
}
