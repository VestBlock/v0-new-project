import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default function LegacyAdminReportPage() {
  redirect('/admin/command-center')
}
