import { redirect } from 'next/navigation'
import Link from 'next/link'
import { checkAdminAccess } from '@/lib/auth/admin'
import { Button } from '@/components/ui/button'
import { LeadDetailClient } from '@/components/admin/lead-detail-client'

export const dynamic = 'force-dynamic'

export default async function AdminLeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const adminCheck = await checkAdminAccess()
  if (!adminCheck.isAdmin) {
    redirect('/dashboard')
  }

  const { id } = await params

  return (
    <div className="space-y-6 px-4 py-6 md:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-slate-400">Lead intelligence</p>
          <h1 className="text-2xl font-semibold text-white">Lead detail</h1>
        </div>
        <Button asChild variant="outline">
          <Link href="/admin/leads">Back to leads</Link>
        </Button>
      </div>

      <LeadDetailClient leadId={id} />
    </div>
  )
}
