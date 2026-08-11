import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { PropertyIntelligenceDashboard } from '@/components/admin/property-intelligence-dashboard'
import { checkAdminAccess } from '@/lib/auth/admin'

export const dynamic = 'force-dynamic'

export default async function AdminDealHunterPage() {
  const adminCheck = await checkAdminAccess()
  if (!adminCheck.isAdmin) redirect('/dashboard')

  return (
    <div className="space-y-6 px-4 py-6 md:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-slate-400">AI Deal Hunter / OSINT Property Intelligence</p>
          <h1 className="text-2xl font-semibold text-white">Property Intelligence</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-400">
            Import public county data, score vacant/distressed opportunities, review map context, and generate compliant outreach drafts from documented public signals.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline"><Link href="/admin/command-center">Command Center</Link></Button>
          <Button asChild variant="outline"><Link href="/admin/research-checklists">Research Checklists</Link></Button>
          <Button asChild variant="outline"><Link href="/deal-hunter">User View</Link></Button>
        </div>
      </div>

      <PropertyIntelligenceDashboard />
    </div>
  )
}
