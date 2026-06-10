import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ResearchChecklistDashboard } from '@/components/admin/research-checklist-dashboard'
import { checkAdminAccess } from '@/lib/auth/admin'

export const dynamic = 'force-dynamic'

export default async function AdminResearchChecklistsPage() {
  const adminCheck = await checkAdminAccess()
  if (!adminCheck.isAdmin) {
    redirect('/dashboard')
  }

  return (
    <div className="space-y-6 px-4 py-6 md:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-slate-400">Internal diligence workspace</p>
          <h1 className="text-2xl font-semibold text-white">Research Checklist</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-400">
            Review property context, public records, contact quality, and partner fit before outreach or routing.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/admin/investor-partnerships">Investor Partnerships</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/admin/leads">Lead Management</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/admin-panel">Admin Overview</Link>
          </Button>
        </div>
      </div>

      <ResearchChecklistDashboard />
    </div>
  )
}
