import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { OpportunityMatchDashboard } from '@/components/admin/opportunity-match-dashboard'
import { checkAdminAccess } from '@/lib/auth/admin'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Opportunity Matches | VestBlock Admin', robots: { index: false, follow: false } }

export default async function OpportunityMatchesPage() {
  const admin = await checkAdminAccess()
  if (!admin.isAdmin) redirect('/dashboard')
  return <OpportunityMatchDashboard />
}
