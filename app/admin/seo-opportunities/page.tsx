import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default function SeoOpportunitiesPage() {
  redirect('/admin/command-center')
}
