import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Deal Hunter Public Opportunity Signals',
  description:
    'Review privacy-safe public property opportunity signals and request a deeper VestBlock property review.',
  alternates: { canonical: '/deal-hunter' },
}

export default function DealHunterLayout({ children }: { children: React.ReactNode }) {
  return children
}
