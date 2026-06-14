import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default function TestPage() {
  redirect('/admin/command-center')
}
