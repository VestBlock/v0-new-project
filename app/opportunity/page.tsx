import type { Metadata } from 'next'
import { PlatformHub } from '@/components/platform/platform-hub'
import { platformLanes } from '@/lib/platform/lanes'
import { absoluteUrl } from '@/lib/seo/site'
import {
  vestBlockOpenGraphDefaults,
  vestBlockTwitterDefaults,
} from '@/lib/seo/socialMetadata'

const socialTitle = 'Opportunity Roadmaps | VestBlock'
const socialDescription =
  'Build practical next steps across credit, income, business readiness, growth, and visibility with VestBlock.'

export const metadata: Metadata = {
  title: 'Opportunity Roadmaps',
  description: socialDescription,
  alternates: { canonical: '/opportunity' },
  openGraph: {
    ...vestBlockOpenGraphDefaults,
    title: socialTitle,
    description: socialDescription,
    url: absoluteUrl('/opportunity'),
  },
  twitter: {
    ...vestBlockTwitterDefaults,
    title: socialTitle,
    description: socialDescription,
  },
}
export default function OpportunityHubPage() { return <PlatformHub lane={platformLanes.opportunity} /> }
