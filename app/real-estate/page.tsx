import type { Metadata } from 'next'
import { PlatformHub } from '@/components/platform/platform-hub'
import { platformLanes } from '@/lib/platform/lanes'
import { absoluteUrl } from '@/lib/seo/site'
import {
  vestBlockOpenGraphDefaults,
  vestBlockTwitterDefaults,
} from '@/lib/seo/socialMetadata'

const socialTitle = 'Real Estate Paths | VestBlock'
const socialDescription =
  'Choose a VestBlock path to buy, sell, finance, fund, analyze, develop, or operate real estate.'

export const metadata: Metadata = {
  title: 'Real Estate Paths',
  description: socialDescription,
  alternates: { canonical: '/real-estate' },
  openGraph: {
    ...vestBlockOpenGraphDefaults,
    title: socialTitle,
    description: socialDescription,
    url: absoluteUrl('/real-estate'),
  },
  twitter: {
    ...vestBlockTwitterDefaults,
    title: socialTitle,
    description: socialDescription,
  },
}
export default function RealEstateHubPage() { return <PlatformHub lane={platformLanes['real-estate']} /> }
