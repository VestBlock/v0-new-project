import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Gate4B2Prototype } from '@/components/prototypes/gate-4b2/gate-4b2-prototype'
import './prototype.css'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Gate 4B.2 Experience Prototype',
  description: 'Isolated VestBlock experience prototype for owner review.',
  robots: { index: false, follow: false, noarchive: true, nocache: true },
}

export default function Gate4B2PrototypePage() {
  if (
    process.env.NODE_ENV === 'production' &&
    process.env.ENABLE_GATE_4B2_PROTOTYPE !== 'true'
  ) {
    notFound()
  }

  return <Gate4B2Prototype />
}
