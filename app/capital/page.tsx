import type { Metadata } from 'next'
import { Suspense } from 'react'
import { PlatformHub } from '@/components/platform/platform-hub'
import { CapitalWorkbench } from '@/components/capital/capital-workbench'
import { platformLanes } from '@/lib/platform/lanes'

export const metadata: Metadata = { title: 'Capital Paths', description: 'Explore business funding, real estate capital, acquisition capital, business credit, grants, and capital-provider participation through VestBlock.', alternates: { canonical: '/capital' } }
export default function CapitalHubPage() {
  return <><PlatformHub lane={platformLanes.capital} /><Suspense fallback={<section className="vb-capital"><div className="vb-section-shell">Loading Capital paths…</div></section>}><CapitalWorkbench /></Suspense></>
}
