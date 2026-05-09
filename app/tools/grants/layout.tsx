import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { requirePaidToolAccess } from '@/lib/auth/access-server';
import { absoluteUrl } from '@/lib/seo/site';

export const metadata: Metadata = {
  title: 'Small Business Grant Finder And Application Prep',
  description:
    'Use VestBlock to match small business grant opportunities, organize readiness details, and draft clearer application language for review.',
  alternates: {
    canonical: '/tools/grants',
  },
  openGraph: {
    title: 'VestBlock Small Business Grants',
    description:
      'Grant matching, grant-readiness guidance, and draft application language for small business owners.',
    url: absoluteUrl('/tools/grants'),
  },
};

export default async function GrantsLayout({ children }: { children: ReactNode }) {
  await requirePaidToolAccess('/tools/grants');
  return children;
}
