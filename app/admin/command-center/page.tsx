import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { checkAdminAccess } from '@/lib/auth/admin'
import { getCommandCenterData } from '@/lib/admin/commandCenter'
import { buildBossBriefing } from '@/lib/admin/bossAgent'
import { CommandCenterClient } from '@/components/admin/command-center/command-center-client'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Command Center | VestBlock Admin',
  robots: { index: false, follow: false },
}

export default async function CommandCenterPage() {
  const adminCheck = await checkAdminAccess()
  if (!adminCheck.isAdmin) redirect('/dashboard')

  const data = await getCommandCenterData()
  const briefing = buildBossBriefing(data)

  return <CommandCenterClient initialData={data} initialBriefing={briefing} />
}
