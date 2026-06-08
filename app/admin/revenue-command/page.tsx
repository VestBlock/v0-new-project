import Link from 'next/link'
import { redirect } from 'next/navigation'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { checkAdminAccess } from '@/lib/auth/admin'
import { getRevenueCommandCenterData } from '@/lib/admin/revenueCommand'

export const dynamic = 'force-dynamic'

function statusBadge(status: 'green' | 'yellow' | 'red') {
  if (status === 'green') return <Badge variant="success">On track</Badge>
  if (status === 'yellow') return <Badge variant="warning">Watch</Badge>
  return <Badge variant="destructive">Blocked</Badge>
}

function formatDate(value: string | null) {
  if (!value) return 'No report yet'
  return value
}

export default async function RevenueCommandPage() {
  const adminCheck = await checkAdminAccess()
  if (!adminCheck.isAdmin) redirect('/dashboard')

  const command = await getRevenueCommandCenterData()

  return (
    <div className="space-y-6 px-4 py-6 md:px-8">
      <div className="flex flex-col gap-4 rounded-3xl border border-cyan-400/20 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.14),transparent_36%),linear-gradient(135deg,rgba(15,23,42,0.98),rgba(2,6,23,0.96))] p-6 shadow-[0_30px_90px_rgba(8,47,73,0.24)] md:flex-row md:items-end md:justify-between">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-200">
            VestBlock Revenue Command
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white md:text-4xl">
            One cockpit for revenue, outreach, visibility, and operator focus.
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-300 md:text-base">
            This page is read-only. It pulls the business signals we keep chasing across scripts,
            admin pages, AEO assets, and outreach reports into one daily decision board.
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-right">
          <p className="text-sm text-slate-400">Business readiness</p>
          <p className="text-5xl font-semibold text-white">{command.grade}</p>
          <p className="mt-1 text-xs text-slate-400">
            Updated {new Date(command.generatedAt).toLocaleString()}
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {command.metrics.map((item) => (
          <Card key={item.label} className="border-slate-800 bg-slate-950/70">
            <CardHeader className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <CardTitle className="text-base text-white">{item.label}</CardTitle>
                {statusBadge(item.status)}
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-end gap-2">
                <p className="text-3xl font-semibold text-white">{item.value}</p>
                {item.target ? (
                  <p className="pb-1 text-sm text-slate-400">/ {item.target}</p>
                ) : null}
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-400">{item.helper}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {!command.liveDataReachable ? (
        <Card className="border-amber-400/30 bg-amber-400/10">
          <CardHeader>
            <CardTitle className="text-amber-50">Live data unavailable</CardTitle>
            <CardDescription className="text-amber-100/80">
              Supabase reads failed in this environment, so zero-valued cards should not be treated as verified business activity.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-amber-50">
            {command.dataSourceIssues.map((issue) => (
              <div key={`${issue.source}-${issue.message}`} className="rounded-xl border border-amber-300/20 px-3 py-2">
                <span className="font-medium">{issue.source}</span>: {issue.message}
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[1.1fr_.9fr]">
        <Card className="border-slate-800 bg-slate-950/70">
          <CardHeader>
            <CardTitle className="text-white">Fastest Revenue Path</CardTitle>
            <CardDescription>
              The next moves that matter before adding more volume or complexity.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {command.nextActions.length ? (
              command.nextActions.map((action, index) => (
                <div key={action} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">
                    Action {index + 1}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-200">{action}</p>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-400">
                No urgent blocker detected. Keep the daily scorecards running and focus on replies.
              </p>
            )}
            <div className="flex flex-wrap gap-2 pt-2">
              <Button asChild variant="outline">
                <Link href="/admin/leads">Open leads</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/admin/lead-sources">Open lead sources</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/admin/reports/daily">Daily reports</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-slate-950/70">
          <CardHeader>
            <CardTitle className="text-white">Outreach Reality Check</CardTitle>
            <CardDescription>
              This prevents us from confusing automation activity with qualified conversations.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-200">
                Current blocker
              </p>
              <p className="mt-2 text-sm leading-6 text-amber-50">{command.outreach.topBlocker}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-800 p-3">
                <p className="text-xs text-slate-500">Lead emails 24h</p>
                <p className="mt-1 text-2xl font-semibold text-white">
                  {command.outreach.sentLeadEmails24h}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-800 p-3">
                <p className="text-xs text-slate-500">Partner emails 24h</p>
                <p className="mt-1 text-2xl font-semibold text-white">
                  {command.outreach.partnerEmails24h}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-800 p-3">
                <p className="text-xs text-slate-500">Email leads in DB</p>
                <p className="mt-1 text-2xl font-semibold text-white">
                  {command.outreach.usableEmailLeads}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-800 p-3">
                <p className="text-xs text-slate-500">Already contacted</p>
                <p className="mt-1 text-2xl font-semibold text-white">
                  {command.outreach.sentOrContactedLeads}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="border-slate-800 bg-slate-950/70">
          <CardHeader>
            <CardTitle className="text-white">Lead Geography</CardTitle>
            <CardDescription>Top cities in the current lead pool.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {command.outreach.cityMix.length ? (
              command.outreach.cityMix.map((item) => (
                <div key={item.label} className="flex items-center justify-between text-sm">
                  <span className="text-slate-300">{item.label}</span>
                  <Badge variant="outline">{item.count}</Badge>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-400">No city data yet.</p>
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-slate-950/70">
          <CardHeader>
            <CardTitle className="text-white">Lead Sources</CardTitle>
            <CardDescription>Where the current pool is coming from.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {command.outreach.sourceMix.length ? (
              command.outreach.sourceMix.map((item) => (
                <div key={item.label} className="flex items-center justify-between gap-3 text-sm">
                  <span className="truncate text-slate-300">{item.label}</span>
                  <Badge variant="outline">{item.count}</Badge>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-400">No source data yet.</p>
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-slate-950/70">
          <CardHeader>
            <CardTitle className="text-white">Offer Fit</CardTitle>
            <CardDescription>Which services the lead pool currently points toward.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {command.outreach.offerMix.length ? (
              command.outreach.offerMix.map((item) => (
                <div key={item.label} className="flex items-center justify-between gap-3 text-sm">
                  <span className="truncate text-slate-300">{item.label}</span>
                  <Badge variant="outline">{item.count}</Badge>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-400">No offer-fit data yet.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[.85fr_1.15fr]">
        <Card className="border-slate-800 bg-slate-950/70">
          <CardHeader>
            <CardTitle className="text-white">Visibility + Content</CardTitle>
            <CardDescription>
              AEO and indexing controls without pretending citations are guaranteed.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-300">
            <div className="flex items-center justify-between">
              <span>Published assets</span>
              <Badge variant="outline">{command.visibility.publishedContent}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span>Published in 7d</span>
              <Badge variant="outline">{command.visibility.publishedContent7d}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span>Indexed/submitted</span>
              <Badge variant="outline">{command.visibility.indexedContent}</Badge>
            </div>
            <div className="pt-3 text-xs text-slate-500">
              Latest daily report: {formatDate(command.visibility.latestReportDate)}
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-3 font-mono text-xs text-cyan-100">
              {command.visibility.aeoScorecardCommand}
              <br />
              {command.visibility.indexingDryRunCommand}
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-slate-950/70">
          <CardHeader>
            <CardTitle className="text-white">10 Operating Capabilities</CardTitle>
            <CardDescription>
              The systems we are now using beyond normal coding and one-off prompts.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            {command.capabilitySystem.map((capability) => (
              <div
                key={capability.name}
                className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-white">{capability.name}</p>
                  <Badge variant={capability.status === 'active' ? 'success' : 'secondary'}>
                    {capability.status}
                  </Badge>
                </div>
                <p className="mt-2 text-xs leading-5 text-slate-400">{capability.proof}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="border-slate-800 bg-slate-950/70">
          <CardHeader>
            <CardTitle className="text-white">Ops Health</CardTitle>
            <CardDescription>Tasks, scrape runs, and data sources that need attention.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-800 p-3">
              <p className="text-xs text-slate-500">Open tasks</p>
              <p className="mt-1 text-2xl font-semibold text-white">{command.operations.openTasks}</p>
            </div>
            <div className="rounded-2xl border border-slate-800 p-3">
              <p className="text-xs text-slate-500">Urgent tasks</p>
              <p className="mt-1 text-2xl font-semibold text-white">{command.operations.urgentTasks}</p>
            </div>
            <div className="rounded-2xl border border-slate-800 p-3">
              <p className="text-xs text-slate-500">Failed scrapes 24h</p>
              <p className="mt-1 text-2xl font-semibold text-white">
                {command.operations.failedScrapeRuns24h}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-slate-950/70">
          <CardHeader>
            <CardTitle className="text-white">Data Source Warnings</CardTitle>
            <CardDescription>
              Missing tables should not crash the cockpit, but they should not stay invisible.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {command.dataSourceIssues.length ? (
              command.dataSourceIssues.map((issue) => (
                <div key={`${issue.source}-${issue.message}`} className="rounded-2xl border border-red-400/20 bg-red-400/10 p-3">
                  <p className="text-sm font-medium text-red-100">{issue.source}</p>
                  <p className="mt-1 text-xs text-red-100/80">{issue.message}</p>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-400">
                All command-center data sources responded.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
