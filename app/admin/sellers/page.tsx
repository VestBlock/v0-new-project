import Link from 'next/link'
import { redirect } from 'next/navigation'
import { checkAdminAccess } from '@/lib/auth/admin'
import { SellerCaseDashboard } from '@/components/admin/seller-case-dashboard'
import { Button } from '@/components/ui/button'

export default async function AdminSellerCasesPage() {
  const admin = await checkAdminAccess()
  if (!admin.isAdmin) redirect('/dashboard')
  return <div className="space-y-6 px-4 py-6 md:px-8">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><p className="text-sm text-slate-400">Admin workspace</p><h1 className="text-2xl font-semibold text-white">Seller case review</h1><p className="mt-2 max-w-3xl text-sm text-slate-400">Review private seller cases, verify submitted facts, assign accountable follow-up, and preserve each status decision without promising an offer or sale outcome.</p></div>
      <div className="flex flex-wrap gap-2"><Button asChild variant="outline"><Link href="/admin/leads">CRM leads</Link></Button><Button asChild variant="outline"><Link href="/admin/command-center">Command Center</Link></Button></div>
    </div>
    <SellerCaseDashboard />
  </div>
}
