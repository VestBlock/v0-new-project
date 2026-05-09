import { redirect } from 'next/navigation'
import Link from 'next/link'
import { checkAdminAccess } from '@/lib/auth/admin'
import { Button } from '@/components/ui/button'
import { LeadIntelligenceDashboard } from '@/components/admin/lead-intelligence-dashboard'

export const dynamic = 'force-dynamic'

export default async function AdminLeadsPage() {
  const adminCheck = await checkAdminAccess()
  if (!adminCheck.isAdmin) {
    redirect('/dashboard')
  }

  return (
    <div className="space-y-6 px-4 py-6 md:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-slate-400">Admin workspace</p>
          <h1 className="text-2xl font-semibold text-white">Lead Intelligence Engine</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/admin/market-expansion">Market Expansion</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/admin/lead-sources">Lead Sources</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/admin/scrape-runs">Scrape Runs</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/admin-panel">Admin Overview</Link>
          </Button>
        </div>
      </div>

      <LeadIntelligenceDashboard />
    </div>
  )
}
