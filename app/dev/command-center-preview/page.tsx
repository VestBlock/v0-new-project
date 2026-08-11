import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { AdminShell } from "@/components/admin/admin-shell"
import { FounderCockpit } from "@/components/admin/command-center/founder-cockpit"
import { getAutopilotCockpitSnapshot } from "@/lib/autopilot/cockpit"
import { buildBossBriefing } from "@/lib/admin/bossAgent"
import { getCommandCenterData } from "@/lib/admin/commandCenter"
import { loadBossLearning } from "@/lib/admin/selfImprovement"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Command Center Preview | VestBlock",
  robots: { index: false, follow: false },
}

export default async function CommandCenterPreviewPage() {
  if (process.env.NODE_ENV === "production") {
    notFound()
  }

  const [data, learning] = await Promise.all([getCommandCenterData(), loadBossLearning()])
  const bossBriefing = buildBossBriefing(data, learning)
  const cockpit = await getAutopilotCockpitSnapshot(data)

  return (
    <AdminShell>
      <FounderCockpit
        initialData={data}
        initialCockpit={cockpit}
        initialBossBriefing={bossBriefing}
      />
    </AdminShell>
  )
}
