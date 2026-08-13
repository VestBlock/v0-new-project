import type { Metadata } from 'next'
import { PlatformHub } from '@/components/platform/platform-hub'
import { platformLanes } from '@/lib/platform/lanes'

export const metadata: Metadata = { title: 'Opportunity Roadmaps', description: 'Build practical next steps across credit, income, business readiness, growth, and visibility with VestBlock.', alternates: { canonical: '/opportunity' } }
export default function OpportunityHubPage() { return <PlatformHub lane={platformLanes.opportunity} /> }
