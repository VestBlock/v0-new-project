import type { Metadata } from 'next'
import { PlatformHub } from '@/components/platform/platform-hub'
import { platformLanes } from '@/lib/platform/lanes'

export const metadata: Metadata = { title: 'Real Estate Paths', description: 'Choose a VestBlock path to buy, sell, finance, fund, analyze, develop, or operate real estate.', alternates: { canonical: '/real-estate' } }
export default function RealEstateHubPage() { return <PlatformHub lane={platformLanes['real-estate']} /> }
