import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { checkAdminAccess } from '@/lib/auth/admin'
import { getCommandCenterData } from '@/lib/admin/commandCenter'
import { buildBossBriefing } from '@/lib/admin/bossAgent'
import { loadBossLearning } from '@/lib/admin/selfImprovement'
import { CommandCenterClient } from '@/components/admin/command-center/command-center-client'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Command Center | VestBlock Admin',
  robots: { index: false, follow: false },
}

async function loadCommandCenterPageData() {
  try {
    const [data, learning] = await Promise.all([getCommandCenterData(), loadBossLearning()])
    return {
      status: 'ready' as const,
      data,
      bossBriefing: buildBossBriefing(data, learning),
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load command center data.'
    console.error('[admin-command-center] data load failed', error)
    return { status: 'error' as const, message }
  }
}

function AdminConsoleFallback({ message }: { message: string }) {
  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-4xl flex-col justify-center px-6 py-16">
      <div className="rounded-3xl border border-amber-300/20 bg-[#11131a] p-8 shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
        <div className="inline-flex items-center rounded-full border border-amber-300/25 bg-amber-300/10 px-3 py-1 text-[0.68rem] font-medium uppercase tracking-[0.2em] text-amber-100">
          Admin degraded mode
        </div>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white">The admin console is loading in safe mode.</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
          We hit a server-side admin data failure, so the page is staying up instead of crashing. Core admin navigation is still available while the live command-center feed is being repaired.
        </p>
        <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">Server detail</p>
          <p className="mt-2 text-sm text-slate-200">{message}</p>
        </div>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/admin/leads"
            className="vb-admin-fallback-primary inline-flex items-center rounded-xl border border-cyan-300/25 bg-cyan-300/10 px-4 py-2 text-sm font-medium text-cyan-100 transition-colors hover:border-cyan-200/40 hover:bg-cyan-300/15"
          >
            Open leads
          </Link>
          <Link
            href="/admin/scrape-runs"
            className="inline-flex items-center rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-medium text-slate-200 transition-colors hover:border-white/20 hover:text-white"
          >
            Open scrape runs
          </Link>
          <Link
            href="/dashboard"
            className="inline-flex items-center rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-medium text-slate-200 transition-colors hover:border-white/20 hover:text-white"
          >
            Back to dashboard
          </Link>
        </div>
      </div>
    </div>
  )
}

export default async function CommandCenterPage() {
  const adminCheck = await checkAdminAccess()
  if (!adminCheck.isAdmin) redirect('/dashboard')

  const result = await loadCommandCenterPageData()
  if (result.status === 'error') {
    return <AdminConsoleFallback message={result.message} />
  }

  return <CommandCenterClient initialData={result.data} initialBossBriefing={result.bossBriefing} />
}
