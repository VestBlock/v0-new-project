import Link from 'next/link'
import { redirect } from 'next/navigation'

import { EntitySeoOpportunitiesDashboard } from '@/components/admin/entity-seo-opportunities-dashboard'
import { Button } from '@/components/ui/button'
import { checkAdminAccess } from '@/lib/auth/admin'

export const dynamic = 'force-dynamic'

export default async function SeoOpportunitiesPage() {
  const adminCheck = await checkAdminAccess()
  if (!adminCheck.isAdmin) redirect('/dashboard')

  return (
    <div className="space-y-6 px-4 py-6 md:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-slate-400">SEO automation</p>
          <h1 className="text-2xl font-semibold text-white">Entity SEO Opportunities</h1>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline"><Link href="/api/admin/content/seo-export">Live Page CSV</Link></Button>
          <Button asChild variant="outline"><Link href="/admin/reports/daily">Daily reports</Link></Button>
          <Button asChild variant="outline"><Link href="/admin-panel">Admin home</Link></Button>
        </div>
      </div>

      <EntitySeoOpportunitiesDashboard />
    </div>
  )
}
