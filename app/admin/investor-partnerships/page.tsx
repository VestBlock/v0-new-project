import Link from 'next/link'
import { redirect } from 'next/navigation'
import { checkAdminAccess } from '@/lib/auth/admin'
import { Button } from '@/components/ui/button'
import { InvestorPartnershipEngineDashboard } from '@/components/admin/investor-partnership-engine-dashboard'

export const dynamic = 'force-dynamic'

export default async function AdminInvestorPartnershipsPage() {
  const adminCheck = await checkAdminAccess()
  if (!adminCheck.isAdmin) {
    redirect('/dashboard')
  }

  return (
    <div className="space-y-6 px-4 py-6 md:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-slate-400">DealVault relationship database</p>
          <h1 className="text-2xl font-semibold text-white">Investor Outreach & Partnership Engine</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-400">
            Identify active investors, score partnership fit, initiate deal-flow, disposition, financing, and strategic partnership outreach, then route replies into DealVault.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/admin/buyers">Buyer Network</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/admin/lenders">Lender Network</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/admin/research-checklists">Research Checklist</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/admin-panel">Admin Overview</Link>
          </Button>
        </div>
      </div>

      <InvestorPartnershipEngineDashboard />
    </div>
  )
}
