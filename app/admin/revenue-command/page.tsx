import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default function RevenueCommandPage() {
  redirect('/admin/command-center')
}
