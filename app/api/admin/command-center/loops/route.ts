export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { checkAdminAccess } from '@/lib/auth/admin'
import { runDailyOperatingLoop } from '@/lib/admin/dailyOperatingLoop'
import { loadOperatingLoopTelemetryFromDatabase } from '@/lib/admin/operatingLoops'
import { getCommandCenterData } from '@/lib/admin/commandCenter'
import { commandCenterAuthError } from '../auth'

const loopRunSchema = z.object({
  dryRun: z.boolean().optional().default(true),
  dispatch: z.boolean().optional().default(false),
  send: z.boolean().optional().default(false),
})

export async function GET() {
  const adminCheck = await checkAdminAccess()
  if (!adminCheck.isAdmin) {
    return commandCenterAuthError(adminCheck)
  }

  try {
    const data = await getCommandCenterData()
    const telemetry = await loadOperatingLoopTelemetryFromDatabase({
      sentToday: data.strategyLab.sentToday,
      remainingToday: data.strategyLab.remainingToday,
      replySignals7d: data.strategyLab.replySignals7d,
      emailReady: data.strategyLab.emailReady,
      needsReview: data.strategyLab.needsReview,
      followupsDue: data.outboundControl.followupsDue,
      activeSuppressionCount: data.suppressionCenter.activeCount,
      missingSuppressionDb: data.suppressionCenter.missingDb,
      buyerDemandSignals: data.summary.activePartners + data.summary.builderPartners,
      pendingMatches: data.routingQueue.reduce((sum, item) => sum + item.count, 0),
      partnerBuyBoxesConfirmed: data.summary.partnerBuyBoxesConfirmed,
      partnerResearchReady: data.summary.partnerResearchReady,
      partnerOutreachReady: data.summary.partnerOutreachReady,
      partnerDiscoveryRuns7d: data.summary.partnerDiscoveryRuns7d,
      failedPartnerRuns7d: data.summary.failedPartnerRuns7d,
      sourceFreshCount: data.dealMachineFreshness.freshCount,
      sourceStaleCount: data.dealMachineFreshness.staleCount,
      staleExportCount: data.dealMachineFreshness.staleCount,
      staleExportTotal: data.localSignals.dmExports.length,
      activeDirectiveCount: data.strategyLab.activeDirectiveCount,
      overdueTaskCount: data.overdueTasks.length,
      urgentTaskCount: data.summary.urgentTasks,
      openTaskCount: data.summary.openTasks,
      legacyDraftCount: data.summary.hiddenLegacyDrafts,
      archivedLegacyRuntimeRows: data.summary.archivedLegacyRuntimeRows,
      analyzerOutcomeCount: data.dealMemory.totalAnalyses,
    })
    return NextResponse.json({ success: true, telemetry })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to load operating loops.' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const adminCheck = await checkAdminAccess()
  if (!adminCheck.isAdmin) {
    return commandCenterAuthError(adminCheck)
  }

  const parsed = loopRunSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  try {
    const result = await runDailyOperatingLoop({
      dryRun: parsed.data.dryRun,
      dispatch: parsed.data.dispatch,
      send: parsed.data.send,
      createdByUserId: adminCheck.user?.id || null,
    })
    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Operating loop failed.' },
      { status: 500 }
    )
  }
}
