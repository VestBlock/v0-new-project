import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default function AdminPrEnginePage() {
  redirect('/admin/command-center')
}
