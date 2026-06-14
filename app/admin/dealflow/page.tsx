import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default function AdminDealFlowCommandPage() {
  redirect('/admin/command-center')
}
