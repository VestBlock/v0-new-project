import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default function LegacyAdminUserPage() {
  redirect('/admin/command-center')
}
