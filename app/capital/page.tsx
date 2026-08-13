import type { Metadata } from 'next'
import { PlatformHub } from '@/components/platform/platform-hub'
import { platformLanes } from '@/lib/platform/lanes'

export const metadata: Metadata = { title: 'Capital Paths', description: 'Explore business funding, real estate capital, acquisition capital, business credit, grants, and capital-provider participation through VestBlock.', alternates: { canonical: '/capital' } }
export default function CapitalHubPage() { return <PlatformHub lane={platformLanes.capital} /> }
