import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default function ImprovementPage() {
  redirect('/admin/command-center')
}
