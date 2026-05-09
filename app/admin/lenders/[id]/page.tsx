import Link from 'next/link'
import { redirect } from 'next/navigation'
import { checkAdminAccess } from '@/lib/auth/admin'
import { Button } from '@/components/ui/button'
import { LenderDetailClient } from '@/components/admin/lender-detail-client'

export const dynamic = 'force-dynamic'

export default async function AdminLenderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const adminCheck = await checkAdminAccess()
  if (!adminCheck.isAdmin) {
    redirect('/dashboard')
  }

  const { id } = await params

  return (
    <div className="space-y-6 px-4 py-6 md:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-slate-400">Lender network</p>
          <h1 className="text-2xl font-semibold text-white">Lender detail</h1>
        </div>
        <Button asChild variant="outline">
          <Link href="/admin/lenders">Back to lenders</Link>
        </Button>
      </div>

      <LenderDetailClient lenderId={id} />
    </div>
  )
}
