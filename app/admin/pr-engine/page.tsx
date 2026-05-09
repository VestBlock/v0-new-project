import Link from 'next/link'
import { redirect } from 'next/navigation'

import { PrEngineDashboard } from '@/components/admin/pr-engine-dashboard'
import { Button } from '@/components/ui/button'
import { checkAdminAccess } from '@/lib/auth/admin'

export const dynamic = 'force-dynamic'

export default async function AdminPrEnginePage() {
  const adminCheck = await checkAdminAccess()
  if (!adminCheck.isAdmin) {
    redirect('/dashboard')
  }

  return (
    <div className="space-y-6 px-4 py-6 md:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-slate-400">Admin workspace</p>
          <h1 className="text-2xl font-semibold text-white">PR Engine</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/admin/research">Research</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/admin/experiments">Experiments</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/admin/reports/daily">Daily reports</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/admin-panel">Admin overview</Link>
          </Button>
        </div>
      </div>

      <PrEngineDashboard />
    </div>
  )
}
