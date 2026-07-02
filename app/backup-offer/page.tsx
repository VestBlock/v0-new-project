import type { Metadata } from 'next'
import { BackupOfferPage } from '@/components/partners/backup-offer-page'
import { absoluteUrl } from '@/lib/seo/site'

export const metadata: Metadata = {
  title: 'Backup Cash Offer Reviews for Listing Agents',
  description:
    'Listing agents: get a written, no-obligation backup cash review for any listing past 60 days on market. You keep your full commission; your seller gets a real floor.',
  keywords: [
    'backup offer real estate',
    'backup cash offer listing agent',
    'stale listing backup offer',
    'cash offer for listed property',
    'agent backup offer program',
  ],
  alternates: {
    canonical: '/backup-offer',
  },
  openGraph: {
    title: 'Backup Cash Offer Reviews for Listing Agents | VestBlock',
    description:
      'A standing backup cash review for stale listings. Written, no-obligation, and the agent keeps full commission.',
    url: absoluteUrl('/backup-offer'),
  },
}

export default function BackupOfferRoute() {
  return <BackupOfferPage />
}
