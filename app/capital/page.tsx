import type { Metadata } from 'next'
import { Suspense } from 'react'
import { PlatformHub } from '@/components/platform/platform-hub'
import { CapitalWorkbench } from '@/components/capital/capital-workbench'
import { platformLanes } from '@/lib/platform/lanes'
import { absoluteUrl } from '@/lib/seo/site'
import {
  vestBlockOpenGraphDefaults,
  vestBlockTwitterDefaults,
} from '@/lib/seo/socialMetadata'

const socialTitle = 'Capital Paths | VestBlock'
const socialDescription =
  'Explore business funding, real estate capital, acquisition capital, business credit, grants, and capital-provider participation through VestBlock.'

export const metadata: Metadata = {
  title: 'Capital Paths',
  description: socialDescription,
  alternates: { canonical: '/capital' },
  openGraph: {
    ...vestBlockOpenGraphDefaults,
    title: socialTitle,
    description: socialDescription,
    url: absoluteUrl('/capital'),
  },
  twitter: {
    ...vestBlockTwitterDefaults,
    title: socialTitle,
    description: socialDescription,
  },
}
export default function CapitalHubPage() {
  return <><PlatformHub lane={platformLanes.capital} /><Suspense fallback={<section className="vb-capital"><div className="vb-section-shell">Loading Capital paths…</div></section>}><CapitalWorkbench /></Suspense></>
}
