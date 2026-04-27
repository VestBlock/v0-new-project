import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { absoluteUrl } from '@/lib/seo/site';

export const metadata: Metadata = {
  title: 'AI Credit Report Analysis And Dispute Letter Workflow',
  description:
    'Upload a credit report to VestBlock, organize negative items, review AI-powered credit analysis, and prepare dispute-letter drafts for user review.',
  alternates: {
    canonical: '/credit-upload',
  },
  openGraph: {
    title: 'VestBlock AI Credit Report Analysis',
    description:
      'AI credit report upload, analysis, dispute-letter support, workflow alerts, and admin review for credit repair operations.',
    url: absoluteUrl('/credit-upload'),
  },
};

export default function CreditUploadLayout({ children }: { children: ReactNode }) {
  return children;
}

